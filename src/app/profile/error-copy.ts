import type { ProfileLang } from "@/app/profile/copy";

const uz: Record<string, string> = {
  UNKNOWN_ERROR: "Nimadir noto‘g‘ri ketdi. Qayta urinib ko‘ring.",
  NETWORK_ERROR: "Internet aloqasi barqaror emas. Qayta urinib ko‘ring.",
  GRAPHQL_ERROR: "So‘rov bajarilmadi. Qayta urinib ko‘ring.",
  UNAUTHORIZED: "Sessiya tugagan. Qayta kiring.",
  TOKEN_EXPIRED: "Sessiya tugagan. Qayta kiring.",
  INVALID_SESSION: "Sessiya yaroqsiz. Qayta kiring.",
  INVALID_TELEGRAM_AUTH: "Telegram orqali kirish amalga oshmadi.",
  USER_NOT_REGISTERED: "Foydalanuvchi ro‘yxatdan o‘tmagan.",
  VALIDATION_FAILED: "Ma’lumotlar noto‘g‘ri.",
  UPLOAD_FAILED: "Rasm yuklanmadi. Qayta urinib ko‘ring.",
  NOT_CONFIGURED: "Rasm yuklash sozlanmagan. Administrator bilan bog‘laning.",
  BAD_URL: "Server rasm havolasini qaytarmadi.",
  UNSUPPORTED_FILE: "Faqat rasm fayllari qo‘llab-quvvatlanadi.",
  BUSINESS_INACTIVE: "Biznes vaqtincha faol emas.",
  TRIAL_EXPIRED: "Sinov muddati tugagan.",
  BUSINESS_BLOCKED: "Biznes bloklangan.",
  BROADCAST_LIMIT_REACHED: "Kuniga faqat 1 ta xabar yuborish mumkin.",
  MEMBERSHIP_NOT_FOUND: "Biznes tanlanmagan.",
  MISSING_BUSINESS_ID: "Biznes tanlanmagan.",
  BUSINESS_NOT_FOUND: "Biznes topilmadi.",
  BUSINESS_NOT_FOUND_FOR_USER: "Biznes topilmadi.",
};

const ru: Record<string, string> = {
  UNKNOWN_ERROR: "Что-то пошло не так. Попробуйте снова.",
  NETWORK_ERROR: "Нестабильное соединение. Попробуйте снова.",
  GRAPHQL_ERROR: "Запрос не выполнен. Попробуйте снова.",
  UNAUTHORIZED: "Сессия истекла. Войдите снова.",
  TOKEN_EXPIRED: "Сессия истекла. Войдите снова.",
  INVALID_SESSION: "Сессия недействительна. Войдите снова.",
  INVALID_TELEGRAM_AUTH: "Не удалось войти через Telegram.",
  USER_NOT_REGISTERED: "Пользователь не зарегистрирован.",
  VALIDATION_FAILED: "Некорректные данные.",
  UPLOAD_FAILED: "Не удалось загрузить изображение.",
  NOT_CONFIGURED: "Загрузка изображений не настроена.",
  BAD_URL: "Сервер не вернул ссылку на изображение.",
  UNSUPPORTED_FILE: "Поддерживаются только изображения.",
  BUSINESS_INACTIVE: "Бизнес временно неактивен.",
  TRIAL_EXPIRED: "Пробный период истёк.",
  BUSINESS_BLOCKED: "Бизнес заблокирован.",
  BROADCAST_LIMIT_REACHED: "Не больше одного сообщения в день.",
  MEMBERSHIP_NOT_FOUND: "Бизнес не выбран.",
  MISSING_BUSINESS_ID: "Бизнес не выбран.",
  BUSINESS_NOT_FOUND: "Бизнес не найден.",
  BUSINESS_NOT_FOUND_FOR_USER: "Бизнес не найден.",
};

const tables: Record<ProfileLang, Record<string, string>> = { uz, ru };

export function mapErrorCodeToMessage(code: string, lang: ProfileLang = "uz"): string {
  const key = code.trim().toUpperCase();
  const table = tables[lang];
  return table[key] ?? table.UNKNOWN_ERROR ?? "Something went wrong";
}
