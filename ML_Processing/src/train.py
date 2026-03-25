from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, accuracy_score
import pickle
from text_encoding import TextVectorizer, load_training_data

def train_classifier(X_train, y_train):
    """
    Train a logistic regression classifier with encoded text input
    """
    
    model = LogisticRegression(
        solver='saga',          # Handles multilabel problems
        penalty='l2',           # L1 and L2 could have decent impact, tuning later
        C=1.0,                    
        max_iter=1000,            
        class_weight='balanced',  # Handles class imbalance
        random_state=42
    )
    
    model.fit(X_train, y_train)
    return model

def evaluate_classifier(model, X_test, y_test):
    """
    Evaluate model and print metrics.
    """
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    
    print(f"Overall Accuracy: {accuracy*100:.2f}%")
    print("\nClassification Report:")
    print(classification_report(
        y_test, y_pred,
        target_names=['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5']
    ))
    return accuracy

def main():
    # Configuration
    DATA_PATH = 'ML_Processing/data/processed/training_data.csv'
    VECTORIZER_PATH = 'ML_Processing/models/vectorizer_v1.pkl'
    MODEL_PATH = 'ML_Processing/models/classifier_v1.pkl'
    # Load Data
    texts, labels = load_training_data(DATA_PATH)
    
    # Split
    X_train_text, X_test_text, y_train, y_test = train_test_split(
        texts, labels, test_size=0.2, random_state=42, stratify=labels
    )
    
    # Vectorization
    vectorizer_wrapper = TextVectorizer(
        max_features=2000, 
        ngram_range=(1, 2), 
        min_df=2
    )
    # Enable sublinear scaling for better text handling
    vectorizer_wrapper.vectorizer.set_params(sublinear_tf=True)
    
    X_train = vectorizer_wrapper.fit_transform(X_train_text)
    X_test = vectorizer_wrapper.transform(X_test_text)
    
    # Train
    model = train_classifier(X_train, y_train)
    
    # Evaluate
    evaluate_classifier(model, X_test, y_test)
    
    # Save vectorizer
    vectorizer_wrapper.save(VECTORIZER_PATH) 
    
    # Save model
    with open(MODEL_PATH, 'wb') as f:
        pickle.dump(model, f)
    print(f"Classifier saved to {MODEL_PATH}")

if __name__ == "__main__":
    main()