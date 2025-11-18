
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from pymongo import MongoClient
from bson import ObjectId
from dotenv import load_dotenv
import os, base64, uuid, io, datetime
from PIL import Image
import numpy as np
import cv2
import json

# Load .env in same folder if present
BASE_DIR = os.path.dirname(__file__)
ENV_PATH = os.path.join(BASE_DIR, '.env')
if os.path.exists(ENV_PATH):
    load_dotenv(ENV_PATH)

MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://127.0.0.1:27017/face')
UPLOAD_DIR = os.path.join(BASE_DIR, 'public', 'uploads')
ENROLL_DIR = os.path.join(BASE_DIR, 'enroll_images')
MODEL_DIR = os.path.join(BASE_DIR, 'model')
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(ENROLL_DIR, exist_ok=True)
os.makedirs(MODEL_DIR, exist_ok=True)

MODEL_PATH = os.path.join(MODEL_DIR, 'lbph_model.yml')
LABELS_PATH = os.path.join(MODEL_DIR, 'labels.json')

app = Flask(__name__)
CORS(app)

# Connect to MongoDB
client = MongoClient(MONGODB_URI)
db = client.get_default_database()
employees_col = db.get_collection('employees')
attendance_col = db.get_collection('attendances')

# Helpers

def save_dataurl_image(dataUrl: str):
    if not isinstance(dataUrl, str) or ',' not in dataUrl:
        raise ValueError('Invalid dataUrl')
    header, b64 = dataUrl.split(',', 1)
    ext = 'jpg' if 'jpeg' in header or 'jpg' in header else 'png'
    data = base64.b64decode(b64)
    filename = f"img_{int(datetime.datetime.utcnow().timestamp()*1000)}_{uuid.uuid4().hex[:6]}.{ext}"
    path = os.path.join(UPLOAD_DIR, filename)
    with open(path, 'wb') as f:
        f.write(data)
    return f"/uploads/{filename}", filename


def load_image_from_dataurl(dataUrl: str):
    header, b64 = dataUrl.split(',', 1)
    data = base64.b64decode(b64)
    img = Image.open(io.BytesIO(data)).convert('RGB')
    arr = np.array(img)  # RGB
    return arr


def detect_face_opencv(rgb_np):
    # convert to gray and detect first face using Haarcascade
    gray = cv2.cvtColor(rgb_np, cv2.COLOR_RGB2GRAY)
    cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
    detector = cv2.CascadeClassifier(cascade_path)
    faces = detector.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(60,60))
    if len(faces) == 0:
        return None, None
    # pick the biggest face
    faces = sorted(faces, key=lambda x: x[2]*x[3], reverse=True)
    x, y, w, h = faces[0]
    face_img = gray[y:y+h, x:x+w]
    return face_img, (x, y, w, h)


def train_recognizer():
    # Build training data from ENROLL_DIR where images are stored per workerId subfolder
    labels = {}
    images = []
    image_labels = []
    worker_dirs = [d for d in os.listdir(ENROLL_DIR) if os.path.isdir(os.path.join(ENROLL_DIR, d))]
    for idx, workerId in enumerate(sorted(worker_dirs)):
        labels[idx] = workerId
        wdir = os.path.join(ENROLL_DIR, workerId)
        for fname in os.listdir(wdir):
            if not fname.lower().endswith(('.jpg', '.jpeg', '.png')): continue
            path = os.path.join(wdir, fname)
            img = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
            if img is None: continue
            images.append(img)
            image_labels.append(idx)
    if not images:
        # remove model if exists
        try:
            if os.path.exists(MODEL_PATH): os.remove(MODEL_PATH)
            if os.path.exists(LABELS_PATH): os.remove(LABELS_PATH)
        except: pass
        return False
    recognizer = cv2.face.LBPHFaceRecognizer_create()
    recognizer.train(images, np.array(image_labels))
    recognizer.write(MODEL_PATH)
    with open(LABELS_PATH, 'w', encoding='utf-8') as f:
        json.dump(labels, f, ensure_ascii=False)
    try:
        app.logger.info(f"Trained LBPH recognizer: samples={len(images)}, labels={labels}")
    except Exception:
        pass
    return True


def save_enroll_face(workerId: str, face_img_gray: np.ndarray):
    # ensure worker dir
    wdir = os.path.join(ENROLL_DIR, workerId)
    os.makedirs(wdir, exist_ok=True)
    fname = f"face_{int(datetime.datetime.utcnow().timestamp()*1000)}_{uuid.uuid4().hex[:6]}.jpg"
    out = os.path.join(wdir, fname)
    # normalize size
    try:
        face_resized = cv2.resize(face_img_gray, (200, 200))
    except Exception:
        face_resized = face_img_gray
    cv2.imwrite(out, face_resized)
    return out


def load_recognizer():
    if not os.path.exists(MODEL_PATH) or not os.path.exists(LABELS_PATH):
        return None, None
    try:
        recognizer = cv2.face.LBPHFaceRecognizer_create()
        recognizer.read(MODEL_PATH)
        with open(LABELS_PATH, 'r', encoding='utf-8') as f:
            labels = json.load(f)
        # labels: { "0": "workerId0", ... }
        # convert keys to int
        labels = {int(k): v for k, v in labels.items()}
        try:
            app.logger.info(f"Loaded recognizer model from {MODEL_PATH}, labels={labels}")
        except Exception:
            pass
        return recognizer, labels
    except Exception:
        return None, None


def make_serializable(obj):
    """Recursively convert Mongo/Object types to JSON-serializable Python types."""
    # dict
    if isinstance(obj, dict):
        return {k: make_serializable(v) for k, v in obj.items()}
    # list/tuple
    if isinstance(obj, (list, tuple)):
        return [make_serializable(v) for v in obj]
    # ObjectId
    if isinstance(obj, ObjectId):
        return str(obj)
    # datetime
    if isinstance(obj, datetime.datetime):
        return obj.isoformat()
    return obj


# Routes
@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    return send_from_directory(UPLOAD_DIR, filename)


@app.route('/api/upload-image', methods=['POST'])
def api_upload_image():
    body = request.get_json(force=True)
    dataUrl = body.get('dataUrl')
    if not dataUrl:
        return jsonify(success=False, error='Missing dataUrl'), 400
    try:
        url, fid = save_dataurl_image(dataUrl)
        return jsonify(success=True, url=url, id=fid)
    except Exception as e:
        return jsonify(success=False, error=str(e)), 500


@app.route('/api/register', methods=['POST'])
def api_register():
    body = request.get_json(force=True)
    workerId = body.get('workerId') or f"w_{uuid.uuid4().hex[:8]}"
    name = body.get('name')
    department = body.get('department')
    dataUrl = body.get('dataUrl')
    dataUrls = body.get('dataUrls')
    if not dataUrl and not dataUrls:
        return jsonify(success=False, error='Missing dataUrl(s)'), 400
    try:
        samples_paths = []
        # support single dataUrl or list of dataUrls
        urls_to_process = []
        if dataUrls and isinstance(dataUrls, list) and len(dataUrls) > 0:
            urls_to_process = dataUrls
        elif dataUrl:
            urls_to_process = [dataUrl]

        last_upload_url = None
        for d in urls_to_process:
            url, fid = save_dataurl_image(d)
            last_upload_url = url
            rgb = load_image_from_dataurl(d)
            face_img, bbox = detect_face_opencv(rgb)
            if face_img is None:
                # skip if no face detected in this sample
                continue
            enroll_path = save_enroll_face(workerId, face_img)
            samples_paths.append(enroll_path)

        if not samples_paths:
            return jsonify(success=False, error='No face detected in any sample'), 400

        # store employee record (accumulate samples if exist)
        existing = employees_col.find_one({'workerId': workerId})
        if existing and existing.get('samples'):
            all_samples = list(existing.get('samples')) + samples_paths
        else:
            all_samples = samples_paths

        doc = {
            'workerId': workerId,
            'name': name,
            'department': department,
            'imageUrl': last_upload_url,
            'samples': all_samples,
            'createdAt': datetime.datetime.utcnow()
        }
        employees_col.update_one({'workerId': workerId}, {'$set': doc}, upsert=True)
        # retrain recognizer once
        try:
            train_recognizer()
        except Exception:
            pass
        doc_copy = dict(doc)
        doc_copy.pop('samples', None)
        # convert types
        doc_copy = make_serializable(doc_copy)
        return jsonify(success=True, employee=doc_copy)
    except Exception as e:
        return jsonify(success=False, error=str(e)), 500


@app.route('/api/employees', methods=['GET'])
def api_employees():
    include = request.args.get('includeDescriptor', 'false').lower() == 'true'
    docs = list(employees_col.find({}, {'_id': 0}))
    if not include:
        for d in docs:
            d.pop('descriptor', None)
    # make serializable (e.g., createdAt)
    docs = [make_serializable(d) for d in docs]
    return jsonify(success=True, employees=docs)


@app.route('/api/employees', methods=['POST'])
def api_employees_create():
    try:
        body = request.get_json(force=True) or {}
        workerId = body.get('workerId') or f"w_{uuid.uuid4().hex[:8]}"
        name = body.get('name')
        department = body.get('department')
        imageUrl = body.get('imageUrl')
        now = datetime.datetime.utcnow()
        doc = {
            'workerId': workerId,
            'name': name,
            'department': department,
            'imageUrl': imageUrl,
            'samples': [],
            'createdAt': now
        }
        employees_col.update_one({'workerId': workerId}, {'$set': doc}, upsert=True)
        return jsonify(success=True, employee=make_serializable(doc))
    except Exception as e:
        return jsonify(success=False, error=str(e)), 500


@app.route('/api/employees/<workerId>', methods=['PUT'])
def api_employees_update(workerId):
    try:
        body = request.get_json(force=True) or {}
        updates = {}
        if 'name' in body: updates['name'] = body.get('name')
        if 'department' in body: updates['department'] = body.get('department')
        if 'imageUrl' in body: updates['imageUrl'] = body.get('imageUrl')
        if not updates:
            return jsonify(success=False, error='No fields'), 400
        res = employees_col.update_one({'workerId': workerId}, {'$set': updates})
        if res.matched_count == 0:
            return jsonify(success=False, error='Not found'), 404
        doc = employees_col.find_one({'workerId': workerId}, {'_id': 0})
        return jsonify(success=True, employee=make_serializable(doc))
    except Exception as e:
        return jsonify(success=False, error=str(e)), 500


@app.route('/api/employees/<workerId>', methods=['DELETE'])
def api_employees_delete(workerId):
    try:
        doc = employees_col.find_one({'workerId': workerId})
        if not doc:
            return jsonify(success=False, error='Not found'), 404
        # remove enroll images folder if present
        try:
            wdir = os.path.join(ENROLL_DIR, workerId)
            if os.path.exists(wdir) and os.path.isdir(wdir):
                import shutil
                shutil.rmtree(wdir)
        except Exception:
            pass
        employees_col.delete_one({'workerId': workerId})
        return jsonify(success=True)
    except Exception as e:
        return jsonify(success=False, error=str(e)), 500


@app.route('/api/scan-and-mark', methods=['POST'])
def api_scan_and_mark():
    body = request.get_json(force=True)
    dataUrl = body.get('dataUrl')
    if not dataUrl:
        return jsonify(success=False, error='Missing dataUrl'), 400
    try:
        rgb = load_image_from_dataurl(dataUrl)
        face_img, bbox = detect_face_opencv(rgb)
        if face_img is None:
            return jsonify(success=False, error='No face detected'), 400
        # try to load recognizer
        recognizer, labels = load_recognizer()
        match_worker = None
        match_conf = None
        if recognizer is not None and labels is not None:
            try:
                # ensure size matches training
                try:
                    face_resized = cv2.resize(face_img, (200,200))
                except Exception:
                    face_resized = face_img
                label, conf = recognizer.predict(face_resized)
                # LBPH returns confidence where lower is better; threshold example 60
                threshold = float(os.getenv('LBPH_THRESHOLD', '60'))
                try:
                    app.logger.info(f"Predict result label={label} conf={conf} threshold={threshold}")
                except Exception:
                    pass
                if conf <= threshold:
                    match_worker = labels.get(label)
                    match_conf = float(conf)
            except Exception as e:
                # model error
                match_worker = None
        # save upload image
        url, fid = save_dataurl_image(dataUrl)
        attendance = {
            'workerId': match_worker,
            'matched': bool(match_worker is not None),
            'confidence': match_conf,
            'imageUrl': url,
            'timestamp': datetime.datetime.utcnow()
        }
        insert_res = attendance_col.insert_one(attendance)
        # attach inserted id and convert types
        attendance['_id'] = str(insert_res.inserted_id)
        result = {'success': True, 'attendance': make_serializable(attendance)}
        if match_worker is not None:
            emp = employees_col.find_one({'workerId': match_worker}, {'_id':0})
            if emp:
                emp.pop('samples', None)
                result['employee'] = make_serializable(emp)
        return jsonify(result)
    except Exception as e:
        return jsonify(success=False, error=str(e)), 500


@app.route('/api/detect-face', methods=['POST'])
def api_detect_face():
    body = request.get_json(force=True)
    dataUrl = body.get('dataUrl')
    if not dataUrl:
        return jsonify(success=False, error='Missing dataUrl'), 400
    try:
        rgb = load_image_from_dataurl(dataUrl)
        face_img, bbox = detect_face_opencv(rgb)
        if face_img is None:
            return jsonify(success=False, error='No face detected'), 200
        # bbox is (x,y,w,h)
        return jsonify(success=True, bbox={'x': int(bbox[0]), 'y': int(bbox[1]), 'w': int(bbox[2]), 'h': int(bbox[3])})
    except Exception as e:
        return jsonify(success=False, error=str(e)), 500


@app.route('/api/attendances', methods=['GET'])
def api_attendances():
    try:
        limit = int(request.args.get('limit', '50'))
        docs = list(attendance_col.find({}, sort=[('timestamp', -1)]).limit(limit))
        out = []
        for d in docs:
            # convert types
            dd = make_serializable(d)
            # map to frontend-friendly fields
            ts = d.get('timestamp')
            date_str = ''
            time_str = ''
            if isinstance(ts, datetime.datetime):
                date_str = ts.date().isoformat()
                time_str = ts.time().strftime('%H:%M:%S')
            elif isinstance(dd.get('timestamp'), str) and dd.get('timestamp'):
                # already serialized
                try:
                    parsed = datetime.datetime.fromisoformat(dd.get('timestamp'))
                    date_str = parsed.date().isoformat()
                    time_str = parsed.time().strftime('%H:%M:%S')
                except Exception:
                    date_str = dd.get('timestamp')
                # try to resolve worker name from employees collection
            worker_name = ''
            try:
                wid = d.get('workerId')
                if wid:
                    emp = employees_col.find_one({'workerId': wid}, {'name': 1})
                    if emp and emp.get('name'):
                        worker_name = emp.get('name')
            except Exception:
                worker_name = ''

            out.append({
                'id': str(d.get('_id')),
                'workerId': d.get('workerId'),
                'workerName': worker_name,
                'matched': bool(d.get('matched')),
                'confidence': d.get('confidence'),
                'date': date_str,
                'time': time_str,
                'cid': d.get('imageUrl') or dd.get('imageUrl') or ''
            })
        return jsonify(success=True, data=out)
    except Exception as e:
        return jsonify(success=False, error=str(e)), 500


@app.route('/api/attendances/<att_id>', methods=['DELETE'])
def api_attendance_delete(att_id):
    try:
        try:
            oid = ObjectId(att_id)
        except Exception:
            oid = att_id
        res = attendance_col.delete_one({'_id': oid})
        if res.deleted_count == 0:
            return jsonify(success=False, error='Not found'), 404
        return jsonify(success=True)
    except Exception as e:
        return jsonify(success=False, error=str(e)), 500


@app.route('/api/attendances/<att_id>', methods=['PUT'])
def api_attendance_update(att_id):
    try:
        body = request.get_json(force=True) or {}
        updates = {}
        # allow updating workerId, matched, confidence, imageUrl, date+time
        if 'workerId' in body:
            updates['workerId'] = body.get('workerId')
        if 'matched' in body:
            updates['matched'] = bool(body.get('matched'))
        if 'confidence' in body:
            try:
                updates['confidence'] = float(body.get('confidence'))
            except Exception:
                pass
        if 'imageUrl' in body:
            updates['imageUrl'] = body.get('imageUrl')
        # support date and time fields (strings) to update timestamp
        if 'date' in body or 'time' in body:
            date_s = body.get('date')
            time_s = body.get('time')
            try:
                if date_s and time_s:
                    dt = datetime.datetime.fromisoformat(f"{date_s}T{time_s}")
                elif date_s:
                    dt = datetime.datetime.fromisoformat(date_s)
                else:
                    # just time -> combine with today
                    today = datetime.date.today()
                    dt = datetime.datetime.fromisoformat(f"{today.isoformat()}T{time_s}")
                updates['timestamp'] = dt
            except Exception:
                pass

        if not updates:
            return jsonify(success=False, error='No valid fields to update'), 400
        try:
            oid = ObjectId(att_id)
        except Exception:
            oid = att_id
        res = attendance_col.update_one({'_id': oid}, {'$set': updates})
        if res.matched_count == 0:
            return jsonify(success=False, error='Not found'), 404
        # return updated doc
        doc = attendance_col.find_one({'_id': oid})
        return jsonify(success=True, attendance=make_serializable(doc))
    except Exception as e:
        return jsonify(success=False, error=str(e)), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=4000, debug=True)
