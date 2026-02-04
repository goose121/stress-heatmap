import pandas as pd
import numpy as np

# Emotional tone mapping to level of overwhelm 
EMOTION_MAPPING = {
    # Low Stress levels, confidence.
    1: ['admiration', 'amusement', 'approval', 'caring', 'gratitude', 'joy', 'love'],
    # Slightly higher stress, but still fairly confident
    2: ['excitement', 'desire', 'pride', 'optimism', 'relief', 'curiosity'],
    # Neutral, not terribly stressed but still decent workload
    3: ['neutral', 'realization', 'surprise'],
    # Fairly overwhelmed
    4: ['confusion', 'disappointment', 'annoyance', 'sadness', 'disapproval', 'nervousness'],
    # High Stress and Overwhelm
    5: ['anger', 'disgust', 'fear', 'grief','remorse', 'embarrassment']
}


def get_overwhelm_level(row):
    """
    Determine overwhelm level based on the highest intensity emotion present.
    """
    active_levels = []
    
    for level, emotions in EMOTION_MAPPING.items():
        for emotion in emotions:
            if row[emotion] == 1:
                active_levels.append(level)
    
    if not active_levels:
        return 3  # Neutral default
    
    # Return the maximum level detected (Priority on higher stress)
    return max(active_levels)

def transform_data_to_overwhelm_level(input_file, output_file, sample_size=1000):
    """
    Transform GoEmotions dataset to overwhelm classification format.
    
    Args:
        input_file: CSV file from GoEmotions
        output_file: Path to save transformed data
        sample_size: Number of examples to sample 
    """

    df = pd.read_csv(input_file)
    
    # Sample if requested
    if sample_size and sample_size < len(df):
        df = df.sample(n=sample_size, random_state=42)
        print(f"Sampled {sample_size} rows")

    df['label'] = df.apply(get_overwhelm_level, axis=1)
    
    # Keep only text and label columns
    result = df[['text', 'label']]
    
    print("\nLevel of Overwhelm:")
    print(result['label'].value_counts().sort_index())
    print(f"Level 1: {(result['label'] == 1).sum()} examples")
    print(f"Level 2: {(result['label'] == 2).sum()} examples")
    print(f"Level 3: {(result['label'] == 3).sum()} examples")
    print(f"Level 4: {(result['label'] == 4).sum()} examples")
    print(f"Level 5: {(result['label'] == 5).sum()} examples")
    
    result.to_csv(output_file, index=False)
    for level in range(1, 6):
        print(f"\n Level {level} examples")
        examples = result[result['label'] == level].head(3)
        for _, row in examples.iterrows():
            print(f"{row['text'][:80]}")
    
    return result

if __name__ == "__main__":
    # Transform the data
    transform_data_to_overwhelm_level(
        input_file='ML_Processing/data/raw/goemotions_1.csv',
        output_file='ML_Processing/data/processed/overwhelm_data.csv',
        sample_size=1
    )