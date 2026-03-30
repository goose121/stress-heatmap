import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline
import pickle
import os
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import StringTensorType
import onnxruntime as ort


class TextVectorizer:
    """
    Wrapper class for TF-IDF vectorization
    Handles fitting, transforming, saving, and loading
    """
    
    def __init__(self, max_features=2000, ngram_range=(1, 2), min_df=2):
        """
        Initialize TF-IDF vectorizer with parameters
        
        Args:
            max_features (int): Maximum vocabulary size (default: 2000)
            ngram_range (tuple): Range of n-grams (default: (1,2) for unigrams + bigrams)
            min_df (int): Minimum document frequency to include a term (default: 2)
        """
        self.vectorizer = TfidfVectorizer(
            max_features=max_features,
            ngram_range=ngram_range,
            min_df=min_df,
            stop_words='english',  # Remove common English words
            lowercase=True,         # Convert to lowercase
            strip_accents=None # Remove accents
        )
        self.is_fitted = False
        self.vocab_size = 0
    
    def fit(self, texts):
        """
        Fit the vectorizer on training texts
        
        Args:
            texts (list or array): List of text strings
        
        Returns:
            self
        """
        self.vectorizer.fit(texts)
        self.is_fitted = True
        self.vocab_size = len(self.vectorizer.get_feature_names_out())
        return self
    
    def transform(self, texts):
        """
        Transform texts to TF-IDF feature vectors
        
        Args:
            texts (list or array): List of text strings
        
        Returns:
            scipy.sparse matrix: TF-IDF features
        """
        if not self.is_fitted:
            raise ValueError("Vectorizer must be fitted before transforming.")
        
        X = self.vectorizer.transform(texts)
        return X
    
    def fit_transform(self, texts):
        """
        Fit vectorizer and transform texts in one step
        
        Args:
            texts (list or array): List of text strings
        
        Returns:
            scipy.sparse matrix: TF-IDF features
        """
        X = self.vectorizer.fit_transform(texts)
        self.is_fitted = True
        self.vocab_size = len(self.vectorizer.get_feature_names_out())
        return X
    
    def get_feature_names(self):
        """
        Get vocabulary (list of words/n-grams used as features)
        
        Returns:
            array: Feature names
        """
        if not self.is_fitted:
            raise ValueError("Vectorizer must be fitted first")
        return self.vectorizer.get_feature_names_out()
    
    # pkl save/load (kept for backward compatibility / debugging)

    def save(self, filepath):
        """
        Save vectorizer to pickle file.

        Args:
            filepath (str): Path to save file
        """
        if not self.is_fitted:
            raise ValueError("Cannot save unfitted vectorizer")

        directory = os.path.dirname(filepath)
        if directory:
            os.makedirs(directory, exist_ok=True)

        with open(filepath, 'wb') as f:
            pickle.dump(self.vectorizer, f)

        print(f" Vectorizer saved to {filepath}")

    @classmethod
    def load(cls, filepath):
        """
        Load vectorizer from pickle file.

        Args:
            filepath (str): Path to pickle file

        Returns:
            TextVectorizer: Loaded vectorizer instance
        """
        with open(filepath, 'rb') as f:
            vectorizer = pickle.load(f)

        instance = cls()
        instance.vectorizer = vectorizer
        instance.is_fitted = True
        instance.vocab_size = len(vectorizer.get_feature_names_out())
        return instance

# ONNX export  — combines vectorizer + classifier into one deployable model

def export_pipeline_onnx(vectorizer_wrapper, classifier, filepath, target_opset=17):
    """
    Export the full TF-IDF + classifier pipeline as a single ONNX model.

    The exported model accepts raw text strings as input (shape [N, 1]) and
    returns predicted class labels directly, so Android only needs one file
    and zero pre-processing code.

    Args:
        vectorizer_wrapper (TextVectorizer): Fitted TextVectorizer instance.
        classifier: Fitted sklearn classifier (e.g. LogisticRegression).
        filepath (str): Output path for the .onnx file.
        target_opset (int): ONNX opset version (default: 17).

    Returns:
        str: Resolved output filepath.
    """
    if not vectorizer_wrapper.is_fitted:
        raise ValueError("Vectorizer must be fitted before exporting.")

    # Combine both steps — skl2onnx handles TfidfVectorizer natively
    pipeline = Pipeline([
        ('tfidf', vectorizer_wrapper.vectorizer),
        ('clf',   classifier),
    ])

    # Input: batch of raw strings, shape [batch_size, 1]
    initial_type = [('string_input', StringTensorType([None, 1]))]

    onnx_model = convert_sklearn(
        pipeline,
        initial_types=initial_type,
        target_opset=target_opset,
        options={id(classifier): {'zipmap': False}},  # plain int labels, not dicts
    )

    directory = os.path.dirname(filepath)
    if directory:
        os.makedirs(directory, exist_ok=True)

    with open(filepath, 'wb') as f:
        f.write(onnx_model.SerializeToString())

    size_kb = os.path.getsize(filepath) / 1024
    print(f" Pipeline ONNX model saved to {filepath}  ({size_kb:.1f} KB)")
    return filepath


# -----------------------------------------------------------------------------
# ONNX inference helpers  (used by test.py and any future inference code)
# -----------------------------------------------------------------------------

def load_onnx_session(filepath):
    """
    Load an ONNX inference session.

    Args:
        filepath (str): Path to .onnx file.

    Returns:
        onnxruntime.InferenceSession
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"ONNX model not found: {filepath}")
    return ort.InferenceSession(filepath)


def predict_onnx(session, texts):
    """
    Run inference using a loaded ONNX session.

    Args:
        session (onnxruntime.InferenceSession): Loaded ONNX session.
        texts (list[str]): Raw text strings to classify.

    Returns:
        np.ndarray: Predicted class labels (int), shape [N].
    """
    import numpy as np

    input_name = session.get_inputs()[0].name
    # ONNX TF-IDF expects shape [N, 1] — one document per row
    input_array = np.array(texts, dtype=object).reshape(-1, 1)
    outputs = session.run(None, {input_name: input_array})
    return outputs[0]


def load_training_data(filepath):
    """
    Load training data from CSV file
    
    Args:
        filepath (str): Path to training_data.csv
    
    Returns:
        texts (array): Text strings
        labels (array): Numeric labels
    """
    df = pd.read_csv(filepath)
    
    return df['text'].values, df['label'].values


def create_vectorizer(data_path, save_path, max_features=2000, ngram_range=(1, 2), min_df=2):
    """
    Loads data, encode, and save 
    Args:
        data_path (str): Path to training_data.csv
        save_path (str): Path to save vectorizer.pkl
        max_features (int): Maximum vocabulary size
        ngram_range (tuple): N-gram range
        min_df (int): Minimum document frequency
    
    Returns:
        TextVectorizer: Fitted vectorizer instance
    """

    # Load data
    texts, labels = load_training_data(data_path)
    
    # Show label distribution
    unique, counts = pd.Series(labels).value_counts().sort_index().index, pd.Series(labels).value_counts().sort_index().values
    for level, count in zip(unique, counts):
        print(f"Level {level}: {count} examples")
    print()
    
    # Create and fit vectorizer
    print(f"max_features: {max_features}")
    print(f"ngram_range: {ngram_range}")
    print(f"min_df: {min_df}")
    print()
    
    vectorizer = TextVectorizer(
        max_features=max_features,
        ngram_range=ngram_range,
        min_df=min_df
    )
    
    X = vectorizer.fit_transform(texts)
    
    print(f"Vocabulary size: {vectorizer.vocab_size}")
    print(f"Feature matrix shape: {X.shape}")
    print(f"Sparsity: {X.nnz}/{X.shape[0]*X.shape[1]} non-zero ({X.nnz/(X.shape[0]*X.shape[1])*100:.2f}%)")
    print()
    
    # Show sample vocabulary
    vocab = vectorizer.get_feature_names()
    print("Sample vocabulary (first 20 features):")
    for i, word in enumerate(vocab[:20]):
        print(f"  {i+1:2d}. {word}")
    print(f"({len(vocab)-20} more features)")
    print()
    
    # Save
    vectorizer.save(save_path)
    
    return vectorizer


# When run directly, create the vectorizer
if __name__ == "__main__":
    create_vectorizer(
        data_path='data/processed/training_data.csv',
        save_path='models/vectorizer_v1.pkl',
        max_features=2000,
        ngram_range=(1, 2),
        min_df=2
    )