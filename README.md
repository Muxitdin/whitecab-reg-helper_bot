## Description:
🤖 **A Telegram bot** designed to automate the driver registration process for **Whitecab** taxi park of yandex. The bot collects required documents and contact details from drivers, sends them to the admin group, and allows administrators to track the registration status using interactive buttons.

#### Key Features:

- Step-by-step guidance for drivers to upload document photos.
- Sends registration data to the admin group with status management options.
- Interactive buttons for administrators: "Start Registration" and "Complete."
- Provides feedback to drivers once the registration is finished.
<br>
<br>

# Project setup

```bash
$ npm install
```

## Environment Variables Setup
This project uses environment variables to manage configuration settings

### 1. Create Environment File
Create file in the root directory of your project: **.env**

### 2. Add the Following Variables to the ".env" File

```bash
BOT_TOKEN=<your_bot_token>
ADMIN_GROUP_ID=<your_admin_group_id>
```

## Run the project

```bash
# development
$ npm run dev