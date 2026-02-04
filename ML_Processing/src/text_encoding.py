import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
import pickle
import os


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
            strip_accents='unicode' # Remove accents
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
    
    def save(self, filepath):
        """
        Save vectorizer to pickle file
        
        Args:
            filepath (str): Path to save file
        """
        if not self.is_fitted:
            raise ValueError("Cannot save unfitted vectorizer")
        
        # Create directory if it doesn't exist
        directory = os.path.dirname(filepath)
        if directory:  # Only create if there's a directory path
            os.makedirs(directory, exist_ok=True)
        
        with open(filepath, 'wb') as f:
            pickle.dump(self.vectorizer, f)
        
        print(f" Vectorizer saved to {filepath}")
    
    @classmethod
    def load(cls, filepath):
        """
        Load vectorizer from pickle file
        
        Args:
            filepath (str): Path to pickle file
        
        Returns:
            TextVectorizer: Loaded vectorizer instance
        """
        with open(filepath, 'rb') as f:
            vectorizer = pickle.load(f)
        
        # Create instance and set loaded vectorizer
        instance = cls()
        instance.vectorizer = vectorizer
        instance.is_fitted = True
        instance.vocab_size = len(vectorizer.get_feature_names_out())
        
        return instance


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
        print(f"  Level {level}: {count} examples")
    print()
    
    # Create and fit vectorizer
    print(f"  max_features: {max_features}")
    print(f"  ngram_range: {ngram_range}")
    print(f"  min_df: {min_df}")
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
        data_path='ML_Processing/data/processed/training_data.csv',
        save_path='ML_Processing/models/vectorizer_v1.pkl',
        max_features=2000,
        ngram_range=(1, 2),
        min_df=2
    )
    