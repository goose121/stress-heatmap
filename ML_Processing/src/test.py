import pickle
import os

# Import text encoding
from text_encoding import TextVectorizer

def test():
    VECTORIZER_PATH = 'ML_processing/models/vectorizer.pkl'
    MODEL_PATH = 'ML_processing/models/classifier.pkl'
    
    # Load the text vectorizer
    if not os.path.exists(VECTORIZER_PATH):
        print(f"Error: {VECTORIZER_PATH} not found.")
        return
    vectorizer = TextVectorizer.load(VECTORIZER_PATH)
    
    # Load the model classifier
    with open(MODEL_PATH, 'rb') as f:
        model = pickle.load(f)
    
    # Test Cases representing all 5 levels
    test_cases = [
        "I'm actually feeling really productive today and finished my assignment early.",      # Level 1
        "I have a big presentation tomorrow, I'm a bit nervous but excited to show my work.", # Level 2
        "Just sitting in the library doing some light reading for next week's seminar.",       # Level 3
        "I'm starting to fall behind on my lab reports and the deadlines are piling up.",      # Level 4
        "I haven't slept in two days, I'm failing three classes, and I just want to quit."     # Level 5
    ]
    
    # Process and Predict
    X = vectorizer.transform(test_cases)
    hard_preds = model.predict(X)
    
    # Header for the output table
    print(f"{'Test Sentence':<85} | {'Predicted Level'}")
    
    for i, text in enumerate(test_cases):
        # If longer than 80 chars, cut off early.
        display_text = (text[:80] + '..') if len(text) > 80 else text
        print(f"{display_text:<85} | {hard_preds[i]}")

if __name__ == "__main__":
    test()