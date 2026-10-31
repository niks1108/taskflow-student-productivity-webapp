# 🚀 TaskFlow — Student Productivity Web App

A modern, dark-themed productivity workspace built with **React and Firebase**, designed to help students manage tasks, organize their schedules, track productivity, and stay focused.

🌐 **Live Demo:** [Visit TaskFlow](https://student-task-manager-59bf8.web.app)

## ✨ Features

| Feature | Description |
|---|---|
| 📋 Kanban Board | Organize tasks with drag-and-drop across different stages. |
| 📝 Smart Task Management | Create tasks with descriptions, priorities, categories, and due dates. |
| 📊 Productivity Analytics | Visualize task completion and productivity trends. |
| 📅 Monthly Calendar | View tasks and upcoming deadlines in a calendar. |
| ⏱️ Pomodoro Timer | Manage focused study sessions and breaks. |
| 🤖 AI Planning Assistant | Get rule-based suggestions to organize your tasks. |

## 🛠️ Tech Stack

**Frontend**
- React.js
- JavaScript
- HTML5
- CSS3
- Vite

**Backend & Cloud**
- Firebase Authentication
- Cloud Firestore
- Firebase Hosting

**Libraries**
- Recharts
- Lucide React


## ⚙️ Getting Started

### Prerequisites
- Node.js and npm
- A Firebase project
- Firebase Anonymous Authentication enabled
- A configured Cloud Firestore database

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/niks1108/taskflow-student-productivity-webapp.git
   ```

2. Navigate to the project directory:

   ```bash
   cd taskflow-student-productivity-webapp
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Create a `.env` file in the root directory using `.env.example` as a reference.

5. Add your Firebase web app configuration to `.env`.

6. Start the development server:

   ```bash
   npm run dev
   ```

7. Open the local URL displayed by Vite.

### Production Build

```bash
npm run build
```

## 🔥 Firebase Integration

TaskFlow uses Firebase for:

- Anonymous user authentication.
- Cloud Firestore task storage.
- Firebase Hosting deployment.
- Firestore security rules for user-specific data access.

The application uses anonymous authentication. Task access is tied to the authenticated Firebase user UID.

## 🤖 AI Assistant

The planning assistant currently uses local, rule-based logic to generate task suggestions. It does not use an external AI model or require an AI API key.

## 🔐 Security

- Firestore rules enforce user ownership.
- Environment files are excluded from Git.
- Users can access only their own task documents.

## 👨‍💻 Developer

**Nikhil Lathad**

Computer Engineering Student | VIT Pune

git add README.md
git commit -m "Improve README and project documentation"
git push