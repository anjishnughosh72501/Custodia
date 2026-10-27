# Third-Party Notices and Licences

The following components were adapted from React Bits (https://reactbits.dev) and integrated into ClaimFit under the MIT Licence:

## 1. Shiny Text
- **Source**: https://reactbits.dev/text-animations/shiny-text
- **Repository**: https://github.com/DavidHDev/react-bits
- **Licence**: MIT Licence
- **Modifications**: Re-styled to use ClaimFit palette tokens (`--ink`, `--ink-2`, `--paper`), fully accessible with DOM text selectable and visible on first paint.

## 2. Magnet
- **Source**: https://reactbits.dev/animations/magnet
- **Repository**: https://github.com/DavidHDev/react-bits
- **Licence**: MIT Licence
- **Modifications**: Implemented in TypeScript and CSS without external animation dependencies. Bound to desktop pointer only, automatically disabled under `prefers-reduced-motion`.

## 3. Glare Hover
- **Source**: https://reactbits.dev/components/glare-hover
- **Repository**: https://github.com/DavidHDev/react-bits
- **Licence**: MIT Licence
- **Modifications**: Styled using project tokens (`--rule`, `--paper`, `--shadow-1`, `--shadow-2`). Radial glare overlay tracks pointer coordinates and cleanly fades on exit. Respects reduced motion.

## 4. Count Up
- **Source**: https://reactbits.dev/text-animations/count-up
- **Repository**: https://github.com/DavidHDev/react-bits
- **Licence**: MIT Licence
- **Modifications**: Implemented with native `requestAnimationFrame` and `useInView`. Renders immediate final target value when `prefers-reduced-motion` is active.

## 5. Logo Loop / Ticker
- **Source**: https://reactbits.dev/components/logo-loop
- **Repository**: https://github.com/DavidHDev/react-bits
- **Licence**: MIT Licence
- **Modifications**: Custom loop of verified engine claim shapes. Pauses on hover, focus, and document `visibilitychange`. Displays as static wrapped flex layout when `prefers-reduced-motion` is active.
