import pandas as pd
from sklearn.utils import shuffle

def combine_datasets(goemotion_file, synthetic_file, output_file):
    """
    Combine GoEmotions transformed data with synthetic student examples.
    """
    # Load both datasets
    goemotion_df = pd.read_csv(goemotion_file)
    synthetic_df = pd.read_csv(synthetic_file)
    
    print(f"GoEmotions examples: {len(goemotion_df)}")
    print(f"Synthetic examples: {len(synthetic_df)}")
    
    # Combine
    combined_df = pd.concat([goemotion_df, synthetic_df], ignore_index=True)
    
    # Shuffle to mix GoEmotions and synthetic data
    combined_df = shuffle(combined_df, random_state=42)
    
    # Reset index
    combined_df = combined_df.reset_index(drop=True)
    
    print(combined_df['label'].value_counts().sort_index())
    print(f"Level 1: {(combined_df['label'] == 1).sum()} examples ({(combined_df['label'] == 1).sum()/len(combined_df)*100:.1f}%)")
    print(f"Level 2: {(combined_df['label'] == 2).sum()} examples ({(combined_df['label'] == 2).sum()/len(combined_df)*100:.1f}%)")
    print(f"Level 3: {(combined_df['label'] == 3).sum()} examples ({(combined_df['label'] == 3).sum()/len(combined_df)*100:.1f}%)")
    print(f"Level 4: {(combined_df['label'] == 4).sum()} examples ({(combined_df['label'] == 4).sum()/len(combined_df)*100:.1f}%)")
    print(f"Level 5: {(combined_df['label'] == 5).sum()} examples ({(combined_df['label'] == 5).sum()/len(combined_df)*100:.1f}%)")
    
    # Save
    combined_df.to_csv(output_file, index=False)
    print(f"\nSaved combined training data to {output_file}")
    
    return combined_df

if __name__ == "__main__":
    combine_datasets(
        goemotion_file='ML_Processing/data/processed/overwhelm_data.csv',
        synthetic_file='ML_Processing/data/processed/synthetic_student_examples.csv',
        output_file='ML_Processing/data/processed/training_data.csv'
    )