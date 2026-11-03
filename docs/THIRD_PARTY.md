# Third-Party Notices and Licences

The following components were adapted from React Bits (https://reactbits.dev) and integrated into Custodia under the MIT Licence:

## 1. Shiny Text
- **Source**: https://reactbits.dev/text-animations/shiny-text
- **Repository**: https://github.com/DavidHDev/react-bits
- **Licence**: MIT Licence
- **Modifications**: Re-styled to use Custodia palette tokens (`--ink`, `--ink-2`, `--paper`), fully accessible with DOM text selectable and visible on first paint.

## 2. Magnet
- **Source**: https://reactbits.dev/animations/magnet
- **Repository**: https://github.com/DavidHDev/react-bits
- **Licence**: MIT Licence
- **Modifications**: Implemented in TypeScript and CSS without external animation dependencies. Bound to desktop pointer only, automatically disabled under `prefers-reduced-motion`.

## 3. Logo Loop / Ticker
- **Source**: https://reactbits.dev/components/logo-loop
- **Repository**: https://github.com/DavidHDev/react-bits
- **Licence**: MIT Licence
- **Modifications**: Custom loop of verified engine claim shapes. Pauses on hover, focus, and document `visibilitychange`. Displays as static wrapped flex layout when `prefers-reduced-motion` is active.

## 4. NLI Models (Advisory Semantic Inference)

### cross-encoder/nli-deberta-v3-xsmall
- **Model Card**: https://huggingface.co/cross-encoder/nli-deberta-v3-xsmall
- **Pinned Revision**: `a150876415327c80daeff35ca6f68f5ed8cf5c24`
- **Base Architecture**: Microsoft DeBERTa-v3 (`microsoft/mdeberta-v3-base` / `deberta-v3-xsmall`) fine-tuned on SNLI & MultiNLI
- **Licence**: Apache-2.0
- **Modifications**: 
  - Vocabulary pruned from 128,100 to 25,694 tokens (preserving special tokens, top 24,000 unigram tokens, and all repository corpus tokens).
  - Quantized to INT8 (per-channel) using ONNX Runtime dynamic quantization, compressing checkpoint from ~270 MB to 45.8 MB.
  - Accompanied by `id_map.npy` lookup vector mapping original SPM token IDs to pruned embedding rows.

### cross-encoder/nli-MiniLM2-L6-H768
- **Model Card**: https://huggingface.co/cross-encoder/nli-MiniLM2-L6-H768
- **Pinned Revision**: `b95119ce93d3e065de6214e38cd4a97b0f2f2c6d`
- **Base Architecture**: MiniLMv2-L6-H768 distilled from RoBERTa-Large fine-tuned on SNLI & MultiNLI
- **Licence**: Apache-2.0
- **Quantization**: INT8/UINT8 dynamic quantization for CPU (~79 MB).
