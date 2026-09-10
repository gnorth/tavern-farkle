import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
export default defineConfig({root:root+'mobile',publicDir:root+'public',resolve:{alias:{'@':root}},plugins:[react()],css:{postcss:{plugins:[tailwindcss()]}},build:{outDir:root+'android/app/src/main/assets',emptyOutDir:true,target:'es2022'}});
