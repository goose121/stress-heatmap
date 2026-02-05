# Data Sourcing Documentation

## Overview

The student overwhelm classifier was trained on mostly student based examples. Earlier iterations were trained on the GoEmotions dataset. Below is the data details.

---

## Data Sources

### 1. GoEmotions Dataset (Original Source)
- **Name**: GoEmotions
- **Source**: Demszky et al., 2020
- **Link**: https://github.com/google-research/google-research/tree/master/goemotions
- **License**: Creative Commons Attribution 4.0 International
- **Description**: A large-scale human-annotated dataset of 58,000 Reddit comments labeled with 27 emotion categories
- **Transformation**: Emotions mapped to overwhelm levels
- **Usage in Project**: 1 sampled examples transformed to overwhelm levels (Levels 1-5) using emotion-to-stress mapping. Data was not able to used well for student based answers so the minimum was used. 
**Citation**:
```bibtex
@inproceedings{demszky-etal-2020-goemotions,
  title = {GoEmotions: A Dataset of Fine-Grained Emotions},
  author = {Demszky, Dorottya and Movshovitz-Attias, Dana and Inyang, Jeremy and Sass, Indy and Tatomir, Brendan and Basave, Aitor Bikandi and Strohman, Tanya},
  booktitle = {ACL},
  year = {2020}
}
```

### 2. Synthetically Generated Student Examples
- **Count**: 2,087 examples
- **Distribution**: Balanced across all 5 overwhelm levels
- **Source**: AI-generated using language model prompting + manual entry
- **Generation Method**: See "Synthetic Data Generation" section below

---

## Synthetic Data Generation

### Methodology

Synthetic student examples were generated using artificial intelligence language models to create diverse, contextually relevant examples of student overwhelm at different levels. This approach allowed for:
- **Rapid dataset creation** with balanced class representation
- **Domain-specific language** tailored to student contexts
- **Controlled diversity** across multiple overwhelm scenarios
- **Reproducible data** with clear documentation

### Generation Prompt

**Prompts Used**:
```
["Generate 1000 examples of student feelings regarding schoolwork and a label of 1-5 for the level of stress, context is we are building an ML software that will take in a students feelings regarding homework, and develop a heatmap to map overall stress on campus"]
```

```
["Generate an additional 1000"]
```
- Model: [Claude]

## Attribution & Transparency

### AI-Generated Content Statement

Most of the synthetic student examples were **generated using artificial intelligence**. While these examples are not drawn from real students, they were created to:
- Represent typical patterns of student communication
- Maintain linguistic authenticity
- Provide balanced training data across all overwhelm levels
- Enable transparent, reproducible dataset creation

### Limitations of Synthetic Data

Users should be aware that:
- Synthetic examples may reflect patterns in the AI model's training data rather than universal student experience
- The dataset may overrepresent certain writing styles or perspectives
- Real-world student communication may differ from synthetic patterns
- Underrepresented demographics may be inadequately captured in synthetic generation
- Slang terms, and contextual text may not be understood

## Data Privacy & Ethics

### Privacy
- No personally identifiable information is contained in the training data
- No student records from real individuals were used without consent
- Synthetic data is non-sensitive and does not represent actual individuals

### Ethical Considerations
- Synthetic examples were designed to represent general student stress patterns
- Model is intended to support student wellness
- Predictions should be treated as an overall aid, not definitive assessments

---

## Reproducibility

### Current Dataset
- Reproducible via documented prompt and generation process
- Balanced across all classes
- Publicly attributed sources where applicable


## References

Demszky, D., Movshovitz-Attias, D., Inyang, J., Sass, I., Tatomir, B., Basave, A. B., & Strohman, T. (2020). GoEmotions: A Dataset of Fine-Grained Emotions. In *Proceedings of the 58th Annual Meeting of the Association for Computational Linguistics* (pp. 4040-4054).

---

## Document Version

**Last Updated**: February 4, 2026
