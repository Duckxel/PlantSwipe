import React from 'react'
import { createRoot } from 'react-dom/client'
import { ConversationMediaGallery } from './components/messaging/ConversationMediaGallery'
import { I18nextProvider } from 'react-i18next'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: {
          common: {
            back: 'Back',
            close: 'Close',
          }
        }
      }
    },
    lng: 'en',
    fallbackLng: 'en',
  })

const App = () => {
  return (
    <I18nextProvider i18n={i18n}>
      <ConversationMediaGallery conversationId="test" otherUserDisplayName="Test User" onClose={() => {}} />
    </I18nextProvider>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<App />)
