// Профиль ассистента хранится в Firestore (см. useUserProfile / firestoreService)
// и настраивается пользователем. Промпт чата больше не строится на клиенте:
// поиск по записям целиком живёт на сервере (/api/ai/search).

export interface AssistantProfile {
  name: string;
  tone: 'formal' | 'friendly' | 'brief' | 'motivator';
  useEmoji: boolean;
  customRules: string[];
}

export const DEFAULT_PROFILE: AssistantProfile = {
  name: 'VoiceMap AI',
  tone: 'friendly',
  useEmoji: false,
  customRules: [],
};

export const ASSISTANT_WELCOME = 'Спроси голосом или текстом — найду нужный момент в твоих записях. Например: «что я говорил про запуск?»';
