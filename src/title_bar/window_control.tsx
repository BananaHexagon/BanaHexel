import { appWindow } from "@tauri-apps/api/window";
import { Maximize, Minimize, Minus, X } from "lucide-react"
import { window_size_state } from "../window";
import { useRecoilValue } from "recoil";

export const WindowControl = () => {
    const window_size = useRecoilValue(window_size_state);
    return (
        <div id="title_bar_window_control">
            <div
                className="window_control_button"
                id="window_control_minimize_button"
                onClick={minimize}
            >
                <Minus size={16} />
            </div>
            <div
                className="window_control_button"
                id="window_control_maximize_button"
                onClick={window_size.maximized ? unmaximize : maximize}
            >
                {window_size.maximized ? <Minimize size={16} /> : <Maximize size={16} />}
            </div>
            <div
                className="window_control_button"
                id="window_control_close_button"
                onClick={close}
            >
                <X size={16} />
            </div>
        </div>
    )
}

const close = () => { document.dispatchEvent(new Event("close_requested")) };
const maximize = () => { appWindow.maximize() };
const unmaximize = () => { appWindow.unmaximize() };
const minimize = () => { appWindow.minimize() };