import React from "react"
import { useTranslation } from "react-i18next"

export const BottomBar: React.FC = () => {
  const { t } = useTranslation('common')
  return (
    <footer className="max-w-6xl mx-auto mt-10 text-center text-xs opacity-60 px-2 overflow-x-hidden hidden md:block">
      © {new Date().getFullYear()} {t('common.appName')}. {t('common.allRightsReserved')}.
    </footer>
  )
}
