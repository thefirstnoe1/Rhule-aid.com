import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function buildReactComponents() {
  // Ensure output directory exists
  const outputDir = path.join(__dirname, 'public', 'js', 'react');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Check if we're in production mode
  const isProduction = process.env.NODE_ENV === 'production';

  try {
    // Build CFB Schedule React component
    await esbuild.build({
      entryPoints: ['src/react/cfb-schedule.tsx'],
      bundle: true,
      outfile: 'public/js/react/cfb-schedule.js',
      format: 'iife',
      globalName: 'CFBScheduleApp',
      jsx: 'automatic',
      define: {
        'process.env.NODE_ENV': isProduction ? '"production"' : '"development"'
      },
      external: ['react', 'react-dom'],
      minify: isProduction,
      sourcemap: !isProduction,
    });

    console.log(`✅ React components built successfully (${isProduction ? 'production' : 'development'} mode)`);
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

buildReactComponents();