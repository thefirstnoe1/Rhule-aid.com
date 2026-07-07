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
      jsx: 'transform',
      jsxFactory: 'React.createElement',
      jsxFragment: 'React.Fragment',
      tsconfigRaw: {
        compilerOptions: {
          jsx: 'react'
        }
      },
      define: {
        'process.env.NODE_ENV': isProduction ? '"production"' : '"development"'
      },
      external: ['react', 'react-dom'],
      minify: isProduction,
      sourcemap: !isProduction,
      plugins: [{
        name: 'external-globals',
        setup(build) {
          build.onResolve({ filter: /^react$/ }, args => {
            return { path: args.path, external: true }
          })
          build.onResolve({ filter: /^react-dom$/ }, args => {
            return { path: args.path, external: true }
          })
        }
      }],
      banner: {
        js: `
(function() {
  var require = function(module) {
    if (module === 'react') return window.React;
    if (module === 'react-dom') return window.ReactDOM;
    if (module === 'react/jsx-runtime') return {
      jsx: window.React.createElement,
      jsxs: window.React.createElement,
      Fragment: window.React.Fragment
    };
    throw new Error('Module not found: ' + module);
  };
`
      },
      footer: {
        js: `
  window.CFBScheduleComponent = CFBScheduleApp.default || CFBScheduleApp;
})();`
      }
    });

    console.log(`✅ React components built successfully (${isProduction ? 'production' : 'development'} mode)`);
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

buildReactComponents();