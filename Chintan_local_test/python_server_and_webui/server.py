# 99.9% AI garbage + debug hell
# Currently runs on localhost using FastApi https://fastapi.tiangolo.com/
# Uvicorn is used for web server implementation in python https://uvicorn.dev/

import os
import sys
import threading
import time
import webbrowser


#Try for installing packages
try:
    import uvicorn
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import FileResponse
    from pydantic import BaseModel
    import pickle

except ImportError:
    print("Installing required packages...")
    os.system(f"{sys.executable} -m pip install fastapi uvicorn pydantic scikit-learn")
    import uvicorn
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import FileResponse
    from pydantic import BaseModel
    import pickle

#FastAPI Cringe
app = FastAPI()

# This cors thing does browser access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load models
with open("models/vectorizer.pkl", "rb") as f:
    vectorizer = pickle.load(f)

with open("models/classifier.pkl", "rb") as f:
    classifier = pickle.load(f)

# Input
class InputText(BaseModel):
    text: str

@app.post("/predict")
def predict(data: InputText):
    X = vectorizer.transform([data.text])
    rating = int(classifier.predict(X)[0])
    confidence = None
    if hasattr(classifier, "predict_proba"):
        confidence = float(max(classifier.predict_proba(X)[0]))
    return {"Rating": rating, "confidence": confidence}

# html jazz
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def index():
    return FileResponse(os.path.join("static", "index.html"))


# Auto-launch browser & server - I swear this isn't malaware
if __name__ == "__main__":
    def open_browser():
        time.sleep(1)
        webbrowser.open("http://127.0.0.1:8000/")

    threading.Thread(target=open_browser).start()
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
