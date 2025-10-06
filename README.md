# The Smart Engineer - AI-Powered App Builder

Turn your idea into a full-stack application with AI. Generate React + Node.js projects instantly using Google Gemini AI.

## Features

- 🤖 **AI-Powered Code Generation**: Uses Google Gemini to generate complete project structures
- ⚛️ **Full Stack Ready**: Generates both frontend (React + TypeScript) and backend (Node.js + Express)
- 📦 **Instant Download**: Get your project as a ready-to-run .zip file
- 🎨 **Modern UI**: Built with Next.js 15, Tailwind CSS, and Shadcn/UI

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- Google Gemini API Key ([Get one here](https://aistudio.google.com/app/apikey))

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd the-smart-engineer
```

2. Install dependencies:
```bash
npm install
# or
bun install
```

3. Create a `.env` file in the root directory and add your Google Gemini API key:
```env
GEMINI_API_KEY=your_api_key_here
```

4. Run the development server:
```bash
npm run dev
# or
bun dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Enter a description of the app you want to build in the text area
2. Click "Build Project 🚀"
3. Wait for the AI to generate your project structure
4. Download the generated .zip file
5. Extract and run `npm install` in both the frontend and backend directories

## How It Works

1. **User Input**: You describe your app idea in natural language
2. **AI Processing**: Google Gemini analyzes your description and generates a complete project structure
3. **Code Generation**: The AI creates React components, Express API routes, configuration files, and documentation
4. **Package & Download**: All files are packaged into a .zip file for easy download

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Shadcn/UI
- **AI**: Google Gemini AI (gemini-2.0-flash-exp model)
- **Package Manager**: npm/bun

## Project Structure

```
the-smart-engineer/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── generate-project/
│   │   │       └── route.ts          # API endpoint for project generation
│   │   ├── layout.tsx                # Root layout
│   │   ├── page.tsx                  # Homepage
│   │   └── globals.css               # Global styles
│   └── components/
│       └── ui/                       # Shadcn/UI components
├── .env                              # Environment variables (not in repo)
├── .env.example                      # Example environment variables
└── package.json
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Your Google Gemini API key | Yes |

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.