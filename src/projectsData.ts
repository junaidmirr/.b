import type { Project } from './types'

export const projects: Project[] = [
  {
    title: 'doc-engine',
    category: 'Featured Open Source, Vector PDF Engine',
    description: 'A high performance headless document layout and vector rendering engine for React and TypeScript. Renders searchable vector PDF 1.7 streams and 60 FPS HTML5 Canvas previews without headless browsers or server daemons.',
    icon: 'code',
    stack: ['TypeScript', 'React', 'PDF 1.7 Spec', 'HTML5 Canvas', 'npm package'],
    linkLabel: 'View case study',
    fullDescription: 'doc-engine (@worklabs05/doc-engine) is an open source headless document layout and vector rendering engine for React and TypeScript. Unlike traditional approaches that depend on bloated headless Chromium instances (Puppeteer) or heavy Python daemons, doc-engine calculates document layout coordinates in pure TypeScript and emits native vector PDF 1.7 operators and 60 FPS Canvas previews with zero server side overhead.',
    features: [
      'Emits native vector PDF 1.7 paths, text operators, and shapes (no rasterization)',
      'Natural Top Left web coordinates (0,0) automatically converted to PDF standard Bottom Left coordinates',
      'Multi page flow with automatic pagination and synchronized headers and footers',
      'Real time 60 FPS HTML5 Canvas preview for instantaneous in browser rendering',
      'Zero Puppeteer, zero Chromium, and zero Python daemon dependencies',
      'Available on npm as @worklabs05/doc-engine with comprehensive documentation'
    ],
    githubUrl: 'https://github.com/junaidmirr/doc-engine.git',
    liveUrl: 'https://docengine.worklabs.studio',
    technologies: [
      { name: 'Core Engine', details: 'TypeScript, Abstract Syntax Tree (AST), Document Coordinate Matrix, PDF 1.7 Spec' },
      { name: 'Vector Renderers', details: 'PdfRenderer (Binary vector stream serializer), CanvasRenderer (60 FPS Canvas 2D Context)' },
      { name: 'React Integration', details: 'React 19 Components, usePDF Hook, useDocument Hook, DocumentViewer component' },
      { name: 'Distribution', details: 'Published to npm (@worklabs05/doc-engine), Vite, Rollup, ESM and CJS Dual Exports' }
    ]
  },
  {
    title: 'Tauri Core CLI',
    category: 'Open Source Contribution',
    description: 'Upstream contribution to the official Tauri desktop framework CLI (tauri init) enabling automatic prompt skipping in non interactive terminal and CI environments.',
    icon: 'code',
    stack: ['Rust', 'Tauri CLI', 'Open Source', 'CI Workflows'],
    linkLabel: 'View contribution details',
    fullDescription: 'Contributed directly to the official Tauri repository (tauri-apps/tauri) in release 2.12. Enhanced the tauri init command so that when stdin is not a terminal, the CLI automatically skips interactive prompts, preventing IO errors in continuous integration scripts and automated build environments.',
    features: [
      'Official upstream contribution to tauri-apps/tauri merged for Tauri 2 release',
      'Automatic prompt skipping when stdin is not a terminal in tauri init',
      'Eliminated requirement for passing --ci explicitly in headless environments',
      'Prevented IO blocking and panics in automated CI test runners'
    ],
    githubUrl: 'https://github.com/tauri-apps/tauri/pull/15634',
    liveUrl: 'https://github.com/tauri-apps/tauri/pull/15634',
    technologies: [
      { name: 'Repository', details: 'tauri-apps/tauri (Official Tauri Core)' },
      { name: 'Core Language', details: 'Rust, Cargo, tauri-cli crate' },
      { name: 'PR Reference', details: 'Pull Request #15634 (Tauri 2 Release)' }
    ]
  },
  {
    title: 'CoolPath',
    category: 'AI Microclimate Navigation Engine',
    description: 'Intelligent urban heat aware route planner combining FortyGuard thermal rasters, thermodynamic physiological modeling, and Gemini 2.0 to navigate pedestrians and athletes through shade rich pathways.',
    icon: 'globe',
    stack: ['Python', 'FastAPI', 'React Native / Expo', 'Gemini 2.0', 'FortyGuard API'],
    linkLabel: 'View case study',
    fullDescription: 'CoolPath is an AI powered microclimate navigation engine designed to protect pedestrians, runners, and cyclists from extreme urban heat islands. By combining high resolution thermal rasters from FortyGuard with OpenStreetMap topology, Gemini 2.0 natural language parsing, and human thermodynamic physiological modeling, CoolPath routes travelers through shaded, microclimate cooled pathways.',
    features: [
      'Multi objective Pareto routing solver (Fastest vs Shaded vs Balanced thermal paths)',
      'Sub millisecond spatial indexing using Shapely STRtree point in polygon bounding box search',
      'Real time thermodynamic simulation of traveler core body temperature and evaporative limits',
      'Gemini 2.0 agent parsing natural language intent into structured spatial routing queries',
      'Automated route audio briefings generated via AWS Polly speech synthesis',
      'Universal frontend built with Expo React Native compiling to responsive web'
    ],
    githubUrl: 'https://github.com/junaidmirr/coolpath_main',
    liveUrl: '#',
    technologies: [
      { name: 'Spatial Backend', details: 'Python, FastAPI, Shapely (STRtree), NetworkX, OpenStreetMap (OSM) Topology' },
      { name: 'AI & Voice Synthesis', details: 'Google Gemini 2.0 Flash, AWS Polly Speech Engine, Open Meteo Weather API' },
      { name: 'Thermal Intelligence', details: 'FortyGuard Spatial Heat Raster API, Core Thermodynamic Heat Storage Equations' },
      { name: 'Universal Frontend', details: 'Expo, React Native for Web, TypeScript, Tailwind CSS' }
    ]
  },
  {
    title: 'Edugate',
    category: 'Virtual Classroom App',
    description: 'A feature rich Android app for real time video conferencing, screen sharing, and educational resource management.',
    icon: 'rocket',
    stack: ['Kotlin', 'Jetpack Compose', 'Agora RTC', 'Firebase'],
    linkLabel: 'View case study',
    fullDescription: 'Edugate is a modern, feature rich Android application designed to facilitate virtual classrooms and real time collaboration. Built entirely with Jetpack Compose and powered by Agora and Firebase, it provides a seamless experience for educators and students to connect, share screens, and manage educational resources.',
    features: [
      'Real time Video Conferencing powered by Agora RTC SDK',
      'Live Screen Sharing with foreground service integration',
      'Secure Authentication with Google Sign In and Firebase',
      'Comprehensive Document Management (Excel, Word, PDF)',
      'Secure Cloud Storage for educational materials',
      'Real time data synchronization via Firestore',
      'Modern, responsive UI built with Jetpack Compose'
    ],
    githubUrl: 'https://github.com/junaidmirr/Edugate-a-smart-classroom-app.git',
    liveUrl: '#',
    technologies: [
      { name: 'Frontend & UI', details: 'Kotlin, Jetpack Compose, MVVM Architecture, Navigation Compose, Coil, Lifecycle KTX' },
      { name: 'RTC & Collaboration', details: 'Agora RTC Full SDK (v4.6.3), Screen Sharing Service (MediaProjection API)' },
      { name: 'Backend Services', details: 'Firebase Auth, Cloud Firestore, Realtime Database, Firebase Storage' },
      { name: 'Document Handling', details: 'Apache POI (XLSX, DOCX), OpenPDF / LibrePDF (PDF rendering)' },
      { name: 'System Integration', details: 'Foreground Services, Custom FileProvider (EdugateFileProvider)' }
    ]
  },
  {
    title: 'ResuMagic',
    category: 'Full Stack AI App',
    description: 'An on the go easy AI resume builder and editor with Gemini integration.',
    icon: 'spark',
    stack: ['React 19', 'Flask', 'Gemini AI', 'Firebase'],
    linkLabel: 'View case study',
    fullDescription: 'ResuMagic is a modern AI powered resume builder designed to simplify the professional document creation process. It leverages Google Gemini AI to parse existing resumes, generate professional summaries, and provide real time editing suggestions. The app features a high fidelity editor with real time PDF preview and background removal for profile photos.',
    features: [
      'AI powered resume parsing and generation',
      'Real time PDF preview and printing',
      'Integrated background remover for profile photos',
      'Secure authentication with Firebase',
      'Responsive design with Tailwind CSS 4',
      'Captcha protection with Cloudflare Turnstile'
    ],
    githubUrl: '',
    liveUrl: 'https://resumagic-ai-resume-builder.vercel.app',
    technologies: [
      { name: 'Frontend', details: 'React 19, TypeScript, Vite, Tailwind CSS 4, React Router DOM 7, Lucide React, react-to-print' },
      { name: 'AI Engine', details: '@google/generative-ai (Gemini AI SDK), google-generativeai' },
      { name: 'Backend', details: 'Flask (Python), ReportLab (PDF Gen), PyMuPDF (PDF Parsing), python-docx (Word support)' },
      { name: 'Image Processing', details: 'OpenCV (cv2), Pillow (PIL) for Background Remover' },
      { name: 'Services & Infra', details: 'Firebase Auth & Firestore, Vercel, Cloudflare Turnstile, SMTP Integration (Mailjet)' }
    ]
  },
  {
    title: 'AI Credit and Inventory Management App',
    category: 'FinTech AI App',
    description: 'AI enabled credit and inventory management app for small businesses.',
    icon: 'briefcase',
    stack: ['Kotlin', 'Compose', 'Gemini 2.0', 'Firebase'],
    linkLabel: 'View case study',
    fullDescription: 'AI Credit and Inventory Management App is a comprehensive financial tool for small businesses, combining traditional credit management with modern AI features. It uses Gemini 2.0 Flash for real time product identification and financial data analysis, helping merchants manage their inventory and customer debts efficiently.',
    features: [
      'Real time product identification via AI Vision',
      'Automated credit tracking and reminders',
      'Professional Excel and PDF report generation',
      'Offline first capability with cloud sync',
      'Dark or Light mode with Material You theme',
      'Voice enabled chat assistant'
    ],
    githubUrl: 'https://github.com/junaidmirr/Ai-integrated-credit-and-inventory-manager-app.git',
    liveUrl: '#',
    technologies: [
      { name: 'Core Development', details: 'Kotlin, Jetpack Compose, Clean Architecture, Material Design 3 (Material You)' },
      { name: 'AI & Cloud', details: 'Gemini 2.0 Flash, Google Generative AI SDK, Firebase Auth, Firestore, Storage, Android BOM' },
      { name: 'Local Storage', details: 'Room Database, SharedPreferences' },
      { name: 'Multimedia', details: 'CameraX, Coil (Image Loading), Apache POI (Excel Gen), FileProvider' },
      { name: 'Navigation & State', details: 'Jetpack Compose Navigation, Lifecycle, Coroutines & Flow, Version Catalogs' }
    ]
  },
  {
    title: 'Fapper AI',
    category: 'Android AI Assistant',
    description: 'An on screen AI assistant app for Android providing seamless interaction.',
    icon: 'layout',
    stack: ['Kotlin', 'Compose', 'Gemini 1.5', 'Firebase'],
    linkLabel: 'View case study',
    fullDescription: 'Fapper AI is a revolutionary Android application that provides an on screen AI assistant. It allows users to interact with AI without leaving their current app, thanks to a sophisticated floating overlay menu. It features real time screen analysis, voice commands, and AI powered image editing.',
    features: [
      'Floating overlay menu for instant AI access',
      'Real time screen capture and analysis',
      'Voice to text and text to voice interaction',
      'AI image editing (Nano Banana feature)',
      'Cloud sync for history and credits',
      'Offline first with Room database'
    ],
    githubUrl: 'https://github.com/junaidmirr/on-screen-Ai-assistant.git',
    liveUrl: '#',
    technologies: [
      { name: 'Core Development', details: 'Kotlin, Jetpack Compose, Material Design 3 (M3), Coroutines & Flow' },
      { name: 'Artificial Intelligence', details: 'Gemini AI SDK (1.5-flash), gemini-3-pro-image-preview, Google Cloud STT & TTS' },
      { name: 'Backend & Auth', details: 'Firebase Authentication, Google Sign In, Cloud Firestore' },
      { name: 'System Integration', details: 'MediaProjection API, Foreground Services (FloatingService), WindowManager, Coil' },
      { name: 'Architecture', details: 'Clean Architecture, Jetpack Navigation, Gradle (Kotlin DSL), Version Catalog' }
    ]
  },
  {
    title: 'JR Player',
    category: 'Web Media Tool',
    description: 'A custom built high performance video player for the web.',
    icon: 'code',
    stack: ['JavaScript', 'Tailwind CSS', 'HTML5 Video'],
    linkLabel: 'View case study',
    fullDescription: 'JR Player is a custom video player built from the ground up to provide a premium viewing experience. It features a sleek interface, custom controls, and support for various media formats, all while maintaining a tiny footprint.',
    features: [
      'Custom UI controls with sleek animations',
      'Keyboard shortcuts support',
      'Responsive design for all screen sizes',
      'High performance media handling',
      'Dynamic theme support'
    ],
    githubUrl: 'https://github.com/junaidmirr/simple-responsive-custom-js-video-player.git',
    liveUrl: 'https://jr-player.vercel.app',
    technologies: [
      { name: 'Core', details: 'JavaScript (ES6+), HTML5 Video API' },
      { name: 'Styling', details: 'Tailwind CSS' },
      { name: 'Icons', details: 'Lucide React / Heroicons' }
    ]
  }
]
