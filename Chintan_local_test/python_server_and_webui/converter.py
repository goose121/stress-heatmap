import pickle
import numpy as np
from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import StringTensorType
import onnxruntime as ort
import inspect

# Trying to convert to onnx file so it could be run locally on the android app
# Used this website's code https://dev.to/onnxconverter/how-to-convert-ml-models-to-onnx-format-a-complete-guide-2ck8


def convert_vectorizer_to_onnx(pkl_path, onnx_path):
    """
    Convert any vectorizer from pickle to ONNX format.

    Args:
        pkl_path: Path to input .pkl file
        onnx_path: Path to output .onnx file
    """

    # 1. Load the vectorizer
    print("Loading vectorizer...")
    with open(pkl_pah, 'rb') as f:
        vectorizer = pickle.load(f)

    vec_type = type(vectorizer).__name__
    print(f"Vectorizer type: {vec_type}")

    # 2. Determine vectorizer class
    if 'Tfidf' in vec_type:
        VectorizerClass = TfidfVectorizer
        print("Detected: TF-IDF Vectorizer")
    else:
        VectorizerClass = CountVectorizer
        print("Detected: Count Vectorizer (or similar)")

    # 3. Get valid parameters for the class
    valid_params = inspect.signature(VectorizerClass.__init__).parameters

    # 4. Filter parameters
    original_params = vectorizer.get_params()
    filtered_params = {}

    for param, value in original_params.items():
        if param in valid_params:
            filtered_params[param] = value

    # 5. Ensure ONNX compatibility
    filtered_params['strip_accents'] = None

    print(f"Using parameters: {list(filtered_params.keys())}")

    # 6. Create new vectorizer
    new_vectorizer = VectorizerClass(**filtered_params)

    # 7. Copy fitted attributes
    if hasattr(vectorizer, 'vocabulary_'):
        new_vectorizer.vocabulary_ = vectorizer.vocabulary_
        new_vectorizer.fixed_vocabulary_ = True
        print(f"Copied vocabulary: {len(vectorizer.vocabulary_)} features")

    # Copy TF-IDF specific attributes
    if VectorizerClass == TfidfVectorizer:
        for attr in ['idf_', '_tfidf', 'stop_words_']:
            if hasattr(vectorizer, attr):
                setattr(new_vectorizer, attr, getattr(vectorizer, attr))

    # 8. Convert to ONNX
    print("Converting to ONNX...")
    initial_type = [('text_input', StringTensorType([None, 1]))]

    try:
        onnx_model = convert_sklearn(
            new_vectorizer,
            initial_types=initial_type,
            target_opset=14
        )

        # 9. Save ONNX model
        with open(onnx_path, 'wb') as f:
            f.write(onnx_model.SerializeToString())

        print(f"✓ ONNX model saved to: {onnx_path}")

        # 10. Test the model
        test_onnx_model(onnx_path)

        return True

    except Exception as e:
        print(f"✗ Conversion failed: {e}")
        return False


def test_onnx_model(onnx_path):
    """Test the converted ONNX model."""
    try:
        # Create inference session
        ort_session = ort.InferenceSession(onnx_path)

        # Get input/output details
        input_name = ort_session.get_inputs()[0].name
        input_shape = ort_session.get_inputs()[0].shape
        print(f"Input: {input_name}, Shape: {input_shape}")

        # Test with sample text
        test_texts = np.array([
            ["this is a test sentence"],
            ["another example text"],
            ["machine learning model"]
        ])

        # Run inference
        output_name = ort_session.get_outputs()[0].name
        result = ort_session.run(
            [output_name],
            {input_name: test_texts}
        )[0]

        print(f"Output shape: {result.shape}")
        print(f"Number of features: {result.shape[1]}")

        # Show first text's non-zero features
        non_zero_idx = np.nonzero(result[0])[0]
        print(f"First text has {len(non_zero_idx)} non-zero features")

        return True

    except Exception as e:
        print(f"✗ ONNX test failed: {e}")
        return False


# Main execution
if __name__ == "__main__":
    # Update these paths
    input_pkl = "vectorizer.pkl"  # Your pickle file
    output_onnx = "vectorizer.onnx"  # Output ONNX file

    print("=" * 60)
    print("VECTORIZER TO ONNX CONVERTER")
    print("=" * 60)

    success = convert_vectorizer_to_onnx(input_pkl, output_onnx)

    if success:
        print("\n✓ Conversion completed successfully!")
    else:
        print("\n✗ Conversion failed")