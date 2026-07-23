// Английский словарь. Типизирован как Record<TKey, string> по ru.ts —
// пропущенный ключ ловится компилятором, а не пользователем.

import type { TKey } from './ru';

export const en: Record<TKey, string> = {
  // ── Common ─────────────────────────────────────────────────────────────
  'common.back': 'Back',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.delete': 'Delete',
  'common.save': 'Save',
  'common.settingsSaved': 'Settings saved',

  // ── Navigation ─────────────────────────────────────────────────────────
  'nav.library': 'Library',
  'nav.archive': 'Archive',
  'nav.record': 'Record',
  'nav.focus': 'Focus',
  'nav.reminders': 'Reminders',
  'nav.settings': 'Settings',
  'nav.search': 'Search',
  'nav.logout': 'Sign out',

  // ── Sign in ────────────────────────────────────────────────────────────
  'login.tagline': 'Your AI assistant for voice notes',
  'login.title': 'Sign in to start',
  'login.subtitle': 'Your data syncs across devices',
  'login.google': 'Continue with Google',
  'login.signingIn': 'Signing in…',
  'login.demo': 'Demo mode (no sign-in) — development only',
  'login.consent': 'By signing in you agree that your voice data is processed by AI (Google Gemini) for transcription',
  'login.errorGeneric': 'Sign-in failed',
  'login.errorDomain': 'Domain is not authorised in Firebase. Add it to Authorized domains.',
  'login.errorCode': 'Error: {code}',
  'login.errorFailed': 'Could not sign in: {message}',

  // ── Search ─────────────────────────────────────────────────────────────
  'search.title': 'Ask your recordings',
  'search.subtitle': "I'll find the exact moment in any recording",
  'search.voiceButton': 'Search by voice',
  'search.stopButton': 'Stop',
  'search.placeholder': 'Or type: what did I say about…',
  'search.submit': 'Search',
  'search.example1': 'What did I promise to do?',
  'search.example2': 'About the investor',
  'search.example3': 'Last meeting takeaways',
  'search.searching': 'Searching…',
  'search.listening': 'Listening…',
  'search.stopRecording': 'Stop recording',
  'search.sources': 'Sources',
  'search.clear': 'Clear',

  // ── Recording ──────────────────────────────────────────────────────────
  'record.title': 'Live session',
  'record.subtitle': 'Recording a meeting or interview',
  'record.consentHint': 'Say out loud that you are recording — in several states this is required',
  'record.micOnly': 'Microphone',
  'record.both': 'Both',
  'record.speaker': 'Speaker',
  'record.micAndSpeaker': 'Microphone + Speaker',
  'record.upload': 'Upload audio',
  'record.micError': 'Could not access the microphone.',
  'record.saveError': 'Could not save the recording',
  'record.muteUnsupported': 'Use pause to stop recording',
  'record.micOff': 'Microphone off',
  'record.micOn': 'Microphone on',
  'record.autoStop': 'Auto-stop: {minutes} min limit reached',

  // ── Recording consent ──────────────────────────────────────────────────
  'consent.title': 'Announce that you are recording',
  'consent.intro': 'In several US states ({states}) you may record a conversation only with the consent of everyone involved. Recording without consent there breaks the law — it is not just awkward.',
  'consent.sayTitle': 'Say it out loud at the start',
  'consent.sayBody': '"I am recording our meeting" — then wait for an answer. The answer lands in the recording and stands as proof of consent.',
  'consent.legalTitle': 'This is not legal advice',
  'consent.legalBody': 'Rules differ between states and countries. If you record for work, check the requirements of your own jurisdiction.',
  'consent.acknowledge': 'Got it, I will announce it',
  'consent.settingsLabel': 'Recording consent',
  'consent.settingsDescription': 'In several US states you may record a conversation only with everyone’s consent',
  'consent.settingsAction': 'Read',

  // ── Dashboard ──────────────────────────────────────────────────────────
  'dashboard.recent': 'Recent',
  'dashboard.allRecordings': 'All recordings',
  'dashboard.empty': 'No recordings yet',
  'dashboard.emptyHint': 'Tap the microphone button to make your first recording.',
  'dashboard.latest': 'Latest',
  'dashboard.processing': 'Processing…',
  'dashboard.processError': 'Processing failed',
  'dashboard.quotaExceeded': 'Limit reached — not transcribed',

  // ── Follow-up ──────────────────────────────────────────────────────────
  'followUp.title': 'Promised, not done',
  'followUp.overdue': '{count} past their deadline',
  'followUp.stale': 'Left over from earlier recordings',
  'followUp.markDone': 'Mark as done',
  'followUp.deadlineWas': 'was due {date}',

  // ── Transcription limit ────────────────────────────────────────────────
  'usage.section': 'Transcription limit',
  'usage.title': 'Transcription this month',
  'usage.plan': 'Plan: {plan}',
  'usage.loading': 'Counting usage…',
  'usage.used': '{used} of {limit} used',
  'usage.left': '{left} left. The counter resets on the 1st.',
  'usage.exhausted': 'Limit reached. New recordings are still saved, but transcription is unavailable until next month or a plan upgrade.',
  'usage.planFree': 'Free',

  // ── Quotes ─────────────────────────────────────────────────────────────
  'quote.copy': 'Copy quote',
  'quote.download': 'Download quote as a file',
  'quote.copied': 'Quote copied with its timecode',
  'quote.saved': 'Quote saved',
  'quote.clipboardError': 'The browser blocked clipboard access. Download the quote as a file instead.',
  'quote.label': 'quote',
  'quote.replicas': '{count} lines',

  // ── Settings: language ─────────────────────────────────────────────────
  'settings.languageSection': 'Language',
  'settings.languageLabel': 'App and AI language',
  'settings.languageDescription': 'Summaries, ideas and search answers will use this language. Speech in the transcript is never translated',
};
