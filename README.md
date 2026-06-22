# RedAgos Client

## Overview

RedAgos Client is the frontend application for the **RedAgos Blood Request and Inventory Management System**. It provides a user-friendly interface for managing blood requests, monitoring inventory, and supporting communication between hospitals, blood banks, and authorized personnel.

## Features

* User authentication and authorization
* Dashboard for monitoring blood inventory and requests
* Blood request submission and tracking
* Blood inventory management
* Donor and recipient information management
* Notification and status updates
* Responsive and modern user interface

## Tech Stack

* **Framework:** Nuxt 4
* **Language:** TypeScript
* **Package Manager:** npm
* **State Management:** Pinia
* **HTTP Client:** Axios
* **Styling:** Tailwind CSS

## Project Structure

```text
RedAgos_client/
├── app/
│   ├── app.vue
│   ├── assets/
│   │   ├── css/
│   │   ├── images/
│   │   └── icons/
│   ├── components/
│   │   ├── common/
│   │   ├── layout/
│   │   ├── request/
│   │   ├── inventory/
│   │   ├── donor/
│   │   └── user/
│   ├── composables/
│   ├── layouts/
│   ├── middleware/
│   ├── pages/
│   │   ├── index.vue
│   │   ├── login.vue
│   │   ├── dashboard/
│   │   ├── blood-requests/
│   │   ├── inventory/
│   │   ├── donors/
│   │   ├── recipients/
│   │   ├── users/
│   │   ├── reports/
│   │   └── settings/
│   ├── plugins/
│   ├── stores/
│   ├── types/
│   └── utils/
├── public/
├── server/
├── nuxt.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Installation

### Clone the Repository

```bash
git clone <repository-url>
cd RedAgos_client
```

### Install Dependencies

```bash
npm install
```

### Start Development Server

```bash
npm run dev
```

The application will be available at:

```text
http://localhost:3000
```

## Build for Production

```bash
npm run build
```

## Preview Production Build

```bash
npm run preview
```

## Development Workflow

1. Create a feature branch.
2. Implement changes and test locally.
3. Commit changes with descriptive messages.
4. Push the branch to GitHub.
5. Create a Pull Request for review.

## Contributors

* Project Manager
* Frontend Developers
* Backend Developers
* QA/Testers

## License

This project is developed as part of a capstone project and is intended for academic purposes.
