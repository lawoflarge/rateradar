// Local entry point. Required for pnpm — Expo's default
// node_modules/expo/AppEntry.js does `import App from '../../App'`, which only
// resolves when `expo` is in <projectRoot>/node_modules/expo/. With pnpm,
// `expo` is a symlink to node_modules/.pnpm/expo@*/..., so `../..` lands
// inside .pnpm/ and Metro can't find App.tsx. Build #8 of RateRadar hit this
// at the EXUpdates "Generate updates resources" script phase.
//
// Fixed by pointing package.json "main" at this file and importing App from
// the project root directly (no parent-directory hops).
import { registerRootComponent } from "expo";
import App from "./App";

registerRootComponent(App);
