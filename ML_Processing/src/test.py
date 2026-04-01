import os
import numpy as np
from text_encoding import load_onnx_session, predict_onnx


def test():
    PIPELINE_PATH = 'models/Model_v2.onnx'

    if not os.path.exists(PIPELINE_PATH):
        print(f"Error: {PIPELINE_PATH} not found. Run train.py first.")
        return

    # Load the single combined ONNX model
    session = load_onnx_session(PIPELINE_PATH)

    # Test cases representing all 5 levels
    test_cases = [
        "I'm actually feeling really productive today and finished my assignment early.",      # Level 1
        "I have a big presentation tomorrow, I'm a bit nervous but excited to show my work.", # Level 2
        "Just sitting in the library doing some light reading for next week's seminar.",       # Level 3
        "I'm starting to fall behind on my lab reports and the deadlines are piling up.",      # Level 4
        "I haven't slept in two days, I'm failing three classes, and I just want to quit."    # Level 5
    ]

    # Predict — raw strings go straight to the model, no separate vectorizer step
    predictions = predict_onnx(session, test_cases)

    print(f"{'Test Sentence':<85} | {'Predicted Level'}")
    for text, pred in zip(test_cases, predictions):
        display_text = (text[:80] + '..') if len(text) > 80 else text
        print(f"{display_text:<85} | {pred}")


if __name__ == "__main__":
    test()
