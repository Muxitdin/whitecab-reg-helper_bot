// the last
const express = require("express");
const { Telegraf, Markup } = require("telegraf");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);
const adminGroupId = process.env.ADMIN_GROUP_ID;

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI).then(() => {
    console.log("MongoDB connected");
});

// MongoDB Schemas
const DriverSchema = new mongoose.Schema({
    telegramId: String,
    username: String,
    language: String,
    passport: {
        fullName: String,
        serialNumber: String,
        birthDate: String,
    },
    driverLicense: {
        series: String,
        number: String,
        issueDate: String,
        categories: String,
    },
    techPassport: {
        series: String,
        number: String,
        year: String,
        model: String,
    },
    phone: String,
    invitedBy: { type: String, default: null },
    registrationStatus: { type: String, default: "pending" },
});

const Driver = mongoose.model("Driver", DriverSchema);

// Available languages
const LANGUAGES = {
    ru: {
        name: "Русский",
        REGISTRATION_STEPS: {
            PASSPORT: {
                fullName: "Введите ФИО:",
                serialNumber: "Введите серийный номер паспорта:",
                birthDate: "Введите дату рождения (DD.MM.YYYY):",
            },
            LICENSE: {
                series: "Введите серию водительского удостоверения:",
                number: "Введите номер водительского удостоверения:",
                issueDate: "Введите дату выдачи (DD.MM.YYYY):",
                categories: "Введите категории:",
            },
            TECH_PASSPORT: {
                series: "Введите серию тех. паспорта:",
                number: "Введите номер тех. паспорта:",
                year: "Введите год выпуска:",
                model: "Введите марку и модель:",
            },
            PHONE: "Отправьте ваш рабочий номер телефона",
        },
    },
    uz: {
        name: "O'zbek",
        REGISTRATION_STEPS: {
            PASSPORT: {
                fullName: "FISh ni kiriting:",
                serialNumber: "Passport seriya raqamini kiriting:",
                birthDate: "Tug'ilgan sanangizni kiriting (KK.OO.YYYY):",
            },
            LICENSE: {
                series: "Haydovchilik guvohnomasining seriyasini kiriting:",
                number: "Haydovchilik guvohnomasining raqamini kiriting:",
                issueDate: "Berilgan sanani kiriting (KK.OO.YYYY):",
                categories: "Toifalarni kiriting:",
            },
            TECH_PASSPORT: {
                series: "Texnik passport seriyasini kiriting:",
                number: "Texnik passport raqamini kiriting:",
                year: "Ishlab chiqarilgan yilini kiriting:",
                model: "Rusumi va modelini kiriting:",
            },
            PHONE: "Ish telefon raqamingizni yuboring",
        },
    },
};

const userSessions = {};

// Helper function to get user's language texts
const getLangText = (userId) => LANGUAGES[userSessions[userId]?.language || "ru"]; // returns an object with texts in the user's language

// Start command handler
bot.command("start", async (ctx) => {
    if (ctx.chat.type !== "private") return; // Игнорируем сообщения из групп и каналов

    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🇷🇺 Русский", "lang_ru"), Markup.button.callback("🇺🇿 O'zbek", "lang_uz")],
    ]);

    ctx.reply("Выберите язык / Tilni tanlang:", keyboard);
});

// Language selection handler
bot.action(/lang_(ru|uz)/, async (ctx) => {
    if (ctx.chat.type !== "private") return; // Игнорируем сообщения из групп и каналов

    const lang = ctx.match[1];
    userSessions[ctx.from.id] = {
        language: lang,
        step: "PASSPORT",
        currentField: "fullName",
        data: {},
    };

    const texts = getLangText(ctx.from.id);
    ctx.reply(texts.REGISTRATION_STEPS.PASSPORT.fullName);
});

// Add friend command
bot.command("invite", async (ctx) => {
    const driver = await Driver.findOne({ telegramId: ctx.from.id.toString() });
    console.log(driver);
    if (!driver || driver.registrationStatus !== "approved") {
        return ctx.reply("Вы должны быть зарегистрированным водителем для приглашения друзей.");
    }

    userSessions[ctx.from.id] = {
        isInviting: true,
        language: driver.language,
        step: "PASSPORT",
        currentField: "fullName",
        data: {},
    };

    const texts = getLangText(ctx.from.id);
    ctx.reply(texts.REGISTRATION_STEPS.PASSPORT.fullName);
});

// List invited drivers command
bot.command("myinvites", async (ctx) => {
    const invitedDrivers = await Driver.find({ invitedBy: ctx.from.id.toString() });
    if (invitedDrivers.length === 0) {
        return ctx.reply("У вас пока нет приглашённых водителей.");
    }

    const message = invitedDrivers
        .map((driver, index) => `${index + 1}. ${driver.passport.fullName} - ${driver.registrationStatus}`)
        .join("\n");

    ctx.reply(`Приглашённые вами водители:\n\n${message}`);
});

// Handle text messages
bot.on("text", async (ctx) => {
    if (ctx.chat.type !== "private") return;

    const session = userSessions[ctx.from.id];
    if (!session) return ctx.reply("Используйте /start для начала регистрации.");

    const texts = getLangText(ctx.from.id);

    // Handle phone number input separately
    if (session.step === "PHONE") {
        const phoneRegex = /^\+?\d[\d\s-()]{8,}$/;
        if (!phoneRegex.test(ctx.message.text)) {
            return ctx.reply("Пожалуйста, введите корректный номер телефона.");
        }
        session.data.phone = ctx.message.text;

        try {
            const driver = await createDriver(ctx, session);
            ctx.reply("Ваши данные отправлены на проверку. Ожидайте ответа.", Markup.removeKeyboard());
            delete userSessions[ctx.from.id];
        } catch (error) {
            console.error("Error creating driver:", error);
            ctx.reply("Произошла ошибка при сохранении данных. Пожалуйста, попробуйте позже.");
        }
        return;
    }

    // Update current field data
    if (!session.data[session.step]) {
        session.data[session.step] = {};
    }
    session.data[session.step][session.currentField] = ctx.message.text;

    // Determine next field/step
    const steps = ["PASSPORT", "LICENSE", "TECH_PASSPORT", "PHONE"];
    const fields = {
        PASSPORT: ["fullName", "serialNumber", "birthDate"],
        LICENSE: ["series", "number", "issueDate", "categories"],
        TECH_PASSPORT: ["series", "number", "year", "model"],
        PHONE: [],
    };

    if (fields[session.step]) {
        const currentFieldIndex = fields[session.step].indexOf(session.currentField);
        if (currentFieldIndex < fields[session.step].length - 1) {
            // Move to next field in current step
            session.currentField = fields[session.step][currentFieldIndex + 1];
            ctx.reply(texts.REGISTRATION_STEPS[session.step][session.currentField]);
        } else {
            // Move to next step
            const currentStepIndex = steps.indexOf(session.step);
            if (currentStepIndex < steps.length - 1) {
                session.step = steps[currentStepIndex + 1];
                if (session.step === "PHONE") {
                    if (!session.isInviting) {
                        ctx.reply(
                            texts.REGISTRATION_STEPS.PHONE,
                            Markup.keyboard([[Markup.button.contactRequest("📞 Отправить контакт")]])
                                .oneTime()
                                .resize()
                        );
                    } else {
                        ctx.reply(texts.REGISTRATION_STEPS.PHONE);
                    }
                } else {
                    session.currentField = fields[session.step][0];
                    ctx.reply(texts.REGISTRATION_STEPS[session.step][session.currentField]);
                }
            }
        }
    }
});

// Handle contact sharing
bot.on("contact", async (ctx) => {
    const session = userSessions[ctx.from.id];
    if (!session || session.step !== "PHONE") {
        return ctx.reply("Пожалуйста, следуйте инструкциям.");
    }

    session.data.phone = ctx.message.contact.phone_number;

    try {
        await createDriver(ctx, session);
        ctx.reply("Ваши данные отправлены на проверку. Ожидайте ответа.", Markup.removeKeyboard());
        delete userSessions[ctx.from.id];
    } catch (error) {
        console.error("Error creating driver:", error);
        ctx.reply("Произошла ошибка при сохранении данных. Пожалуйста, попробуйте позже.");
    }
});

async function createDriver(ctx, session) {
    try {
        const driverData = {
            telegramId: session.isInviting ? null : ctx.from.id.toString(),
            username: ctx.from.username,
            language: session.language,
            passport: session.data.PASSPORT,
            driverLicense: session.data.LICENSE,
            techPassport: session.data.TECH_PASSPORT,
            phone: session.data.phone,
            invitedBy: session.isInviting ? ctx.from.id.toString() : null,
        };

        const driver = new Driver(driverData);
        await driver.save();

        const messageText = `
Новая заявка на регистрацию от @${driver.username}:
${session.isInviting ? "\nПриглашён водителем: @" + ctx.from.username : ""}

📋 Паспорт:
ФИО: ${driver.passport.fullName}
Серия и номер: ${driver.passport.serialNumber}
Дата рождения: ${driver.passport.birthDate}

🚗 Водительское удостоверение:
Серия: ${driver.driverLicense.series}
Номер: ${driver.driverLicense.number}
Дата выдачи: ${driver.driverLicense.issueDate}
Категории: ${driver.driverLicense.categories}

📚 Тех. паспорт:
Серия: ${driver.techPassport.series}
Номер: ${driver.techPassport.number}
Год выпуска: ${driver.techPassport.year}
Марка и модель: ${driver.techPassport.model}

📞 Телефон: ${driver.phone}

Статус: НЕ ВЫПОЛНЯЕТСЯ 🔴`;

        await ctx.telegram.sendMessage(
            adminGroupId,
            messageText,
            Markup.inlineKeyboard([[Markup.button.callback("Начать проверку", `start_${driver._id}`)]])
        );

        return driver;
    } catch (error) {
        console.error("Error in createDriver:", error);
        throw error;
    }
}

// Admin starts checking
bot.action(/start_(.+)/, async (ctx) => {
    const driverId = ctx.match[1];
    const adminId = ctx.from.id;

    const driver = await Driver.findById(driverId);
    if (!driver) return ctx.answerCbQuery("Водитель не найден.");

    if (driver.registrationStatus === "in_progress") {
        return ctx.answerCbQuery("Регистрация уже выполняется другим администратором.");
    }

    driver.registrationStatus = "in_progress";
    await driver.save();

    // Send data separately to admin's private chat
    await ctx.telegram.sendMessage(
        adminId,
        `🔹 Паспортные данные:\nФИО: ${driver.passport.fullName}\nСерия и номер: ${driver.passport.serialNumber}\nДата рождения: ${driver.passport.birthDate}`
    );
    await ctx.telegram.sendMessage(
        adminId,
        `🔹 Водительское удостоверение:\nСерия: ${driver.driverLicense.series}\nНомер: ${driver.driverLicense.number}\nДата выдачи: ${driver.driverLicense.issueDate}\nКатегории: ${driver.driverLicense.categories}`
    );
    await ctx.telegram.sendMessage(
        adminId,
        `🔹 Технический паспорт:\nСерия: ${driver.techPassport.series}\nНомер: ${driver.techPassport.number}\nГод выпуска: ${driver.techPassport.year}\nМарка и модель: ${driver.techPassport.model}`
    );
    await ctx.telegram.sendMessage(adminId, `🔹 Телефон: ${driver.phone}`);

    ctx.editMessageText(
        ctx.update.callback_query.message.text.replace(
            "НЕ ВЫПОЛНЯЕТСЯ 🔴",
            `ВЫПОЛНЯЕТСЯ 🟡\n\nКем: @${ctx.from.username || ctx.from.first_name}`
        ),
        Markup.inlineKeyboard([[Markup.button.callback("Завершить проверку", `complete_${driverId}`)]])
    );

    ctx.answerCbQuery("Вы начали проверку.");
});

// Complete registration
bot.action(/complete_(.+)/, async (ctx) => {
    const driverId = ctx.match[1];
    const driver = await Driver.findById(driverId);

    if (!driver) return ctx.answerCbQuery("Водитель не найден.");
    if (driver.registrationStatus !== "in_progress") {
        return ctx.answerCbQuery("Невозможно завершить проверку.");
    }

    driver.registrationStatus = "approved";
    await driver.save();

    ctx.editMessageText(ctx.update.callback_query.message.text.replace("ВЫПОЛНЯЕТСЯ 🟡", "ВЫПОЛНЕНО 🟢"));

    if (driver.telegramId) {
        await ctx.telegram.sendMessage(
            driver.telegramId,
            "Ваша регистрация завершена! Вот инструкции для начала работы: [ссылки и инструкции]."
        );
    }

    ctx.answerCbQuery("Регистрация завершена.");
});

// Setup webhook and start server
const setWebhook = async () => {
    const webhookUrl = `${
        process.env.NODE_ENV === "production" ? process.env.SERVER_URL : process.env.NGROK_SERVER_URL
    }/bot${process.env.BOT_TOKEN}`;
    try {
        await bot.telegram.deleteWebhook().then(console.log("webhook deleted"));
        await bot.telegram.setWebhook(webhookUrl);
        console.log(`Webhook set to: ${webhookUrl}`);
    } catch (error) {
        console.error("Error setting webhook:", error);
    }
};

app.use(express.json());
app.use(bot.webhookCallback(`/bot${process.env.BOT_TOKEN}`));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    setWebhook();
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
