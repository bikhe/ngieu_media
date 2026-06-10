import asyncio
from django.core.management.base import BaseCommand
from django.conf import settings
from aiogram import Bot, Dispatcher, types, html
from aiogram.filters import CommandStart, Command
from aiogram.utils.keyboard import InlineKeyboardBuilder
from events.models import User
from asgiref.sync import sync_to_async

class Command(BaseCommand):
    help = 'Runs the Telegram Bot using aiogram'

    def handle(self, *args, **options):
        token = getattr(settings, 'TELEGRAM_BOT_TOKEN', 'ТВОЙ_ТОКЕН_ИЗ_BOTFATHER')
        if not token or token == 'ТВОЙ_ТОКЕН_ИЗ_BOTFATHER':
            self.stderr.write("Error: TELEGRAM_BOT_TOKEN is not set or is default.")
            return

        self.stdout.write(f"Starting Telegram Bot...")
        try:
            asyncio.run(self.main(token))
        except KeyboardInterrupt:
            self.stdout.write("Bot stopped.")

    async def main(self, token: str):
        bot = Bot(token=token)
        dp = Dispatcher()

        @dp.message(CommandStart())
        async def cmd_start(message: types.Message):
            user_id = str(message.from_user.id)
            
            # Check if user exists in the database
            user = await sync_to_async(self.get_user)(user_id)
            
            webapp_url = getattr(settings, 'TELEGRAM_WEBAPP_URL', 'http://localhost:5173')
            
            # Build inline keyboard with Web App button
            builder = InlineKeyboardBuilder()
            builder.button(
                text="🚀 Открыть Биржу СМИ",
                web_app=types.WebAppInfo(url=webapp_url)
            )
            markup = builder.as_markup()

            if user:
                role_display = await sync_to_async(self.get_role_display_name)(user)
                text = (
                    f"Привет, <b>{html.quote(message.from_user.first_name)}</b>!\n\n"
                    f"Рады видеть тебя снова. Твой аккаунт привязан к системе.\n"
                    f"Роль: <b>{role_display}</b>\n\n"
                    f"Нажми на кнопку ниже, чтобы запустить приложение и приступить к работе."
                )
            else:
                text = (
                    f"Привет, <b>{html.quote(message.from_user.first_name)}</b>!\n\n"
                    f"Ты еще не зарегистрирован в системе <b>Биржа СМИ</b>.\n\n"
                    f"Чтобы начать работу, нажми на кнопку ниже для открытия приложения, "
                    f"а затем введи инвайт-код, предоставленный администратором."
                )

            await message.answer(text, reply_markup=markup, parse_mode="HTML")

        @dp.message(Command("password"))
        async def cmd_password(message: types.Message):
            user_id = str(message.from_user.id)
            user = await sync_to_async(self.get_user)(user_id)
            if not user:
                await message.answer("Ваш Telegram-аккаунт не привязан к системе. Сначала привяжите его в настройках профиля.")
                return

            parts = message.text.split(maxsplit=1)
            if len(parts) < 2:
                await message.answer("Использование: <code>/password новый_пароль</code>\nНапример: <code>/password MyNewPassword123</code>")
                return

            new_pass = parts[1].strip()
            if len(new_pass) < 6:
                await message.answer("Пароль должен быть не менее 6 символов.")
                return

            await sync_to_async(self.set_user_password)(user, new_pass)
            await message.answer("✅ Ваш пароль успешно изменен!")

        # Start polling
        await dp.start_polling(bot)

    def get_user(self, telegram_id: str):
        try:
            return User.objects.get(telegram_id=telegram_id)
        except User.DoesNotExist:
            return None

    def set_user_password(self, user, password):
        user.set_password(password)
        user.save()

    def get_role_display_name(self, user):
        return user.get_role_display()
