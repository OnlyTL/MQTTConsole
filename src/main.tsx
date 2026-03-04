import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import { registerSW } from "virtual:pwa-register"
import './index.css'
import App from './App.tsx'
import {ThemeProvider} from "@/components/theme-provider.tsx";
import {Toaster} from "sonner";
import {TooltipProvider} from "@/components/ui/tooltip"
import { I18nProvider } from "@/i18n/i18n-provider";

registerSW({
    immediate: true,
})

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ThemeProvider storageKey="mqtt-console-ui-theme" defaultTheme="system">
            <I18nProvider>
                <TooltipProvider>
                    <App/>
                    <Toaster position={'top-center'}/>
                </TooltipProvider>
            </I18nProvider>
        </ThemeProvider>
    </StrictMode>,
)
