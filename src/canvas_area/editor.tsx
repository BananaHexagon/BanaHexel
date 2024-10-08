import { useEffect, useRef, useState } from "react"
import { atom, useRecoilState } from "recoil";
import { selected_tool_id_state } from "../tool_select";
import { canvas_toolsT } from ".";
import { current_layer_state, layer_arr_state } from "../app";
import { brush_tool_color_state, brush_tool_thickness_state, eraser_tool_thickness_state } from "../tool_menu"
import { Option, State } from "../common/utils";
import { editor_tools } from "./editor_tools";
import { undo_stack } from "./undo";
import { file_save_state } from "../title_bar";

type CanvasEditorPropsT = {
    canvas_width: number,
    canvas_height: number,
    zoom: number,
    area_width: number,
    area_height: number,
    scroll_horizontal: number,
    scroll_vertical: number,
}

export const is_mouse_down_in_editor_state = atom({
    key: "is_mouse_down_in_editor_state_atom",
    default: false,
})

export const CanvasEditor = ({
    canvas_width,
    canvas_height,
    zoom: z,
    area_width,
    area_height,
    scroll_horizontal,
    scroll_vertical,
}: CanvasEditorPropsT) => {
    let [once, set_once] = useState(true);
    let [is_mouse_down, set_mouse_down_raw] = useRecoilState(is_mouse_down_in_editor_state);
    const layers_arr = new State(useRecoilState(layer_arr_state));
    const current_layer = new State(useRecoilState(current_layer_state));

    const set_mouse_down = (b: ((currVal: boolean) => boolean) | boolean) => {
        const v = typeof b === "function" ? b(is_mouse_down) : b;
        set_mouse_down_raw(v);
        is_mouse_down = v;
    }

    const div_ref = useRef<HTMLDivElement>(null);
    const canvas_ref = useRef<HTMLCanvasElement>(null);

    const [selected_tool_id, set_selected_tool_id] = useRecoilState(selected_tool_id_state);
    const selected_tool = useRef<canvas_toolsT>("none");
    const brush_color = new State(useRecoilState(brush_tool_color_state));
    const brush_thickness = new State(useRecoilState(brush_tool_thickness_state));
    const eraser_thickness = new State(useRecoilState(eraser_tool_thickness_state));
    const file_state = new State(useRecoilState(file_save_state));
    const need_on_end = new State(useState(true))

    const zoom = useRef(z);
    const fn_data = new State(useState(Option.None<ReturnType<typeof editor_tools>>()));

    useEffect(() => { zoom.current = z }, [z]);

    useEffect(() => {
        const b_tool = selected_tool.current;
        const n_tool = selected_tool_id;
        selected_tool.current = selected_tool_id;
        fn_data.val_local().on_some(fn_data => {
            const on_end = fn_data[b_tool].on_end;
            const on_start = fn_data[n_tool].on_start;
            if (on_end) on_end({ new_tool: n_tool });
            if (on_start) on_start({ old_tool: b_tool });
        })
    }, [selected_tool_id]);

    useEffect(() => {
        fn_data.val_local().on_some(fn_data => {
            const on_canvas_change = fn_data[selected_tool_id].on_canvas_change;
            if (on_canvas_change) on_canvas_change({});
        })
    }, [layers_arr.val_global()![current_layer.val_global()].uuid])

    useEffect(() => {
        const canvas = canvas_ref.current;
        if (!canvas) return;
        canvas.width = canvas_width;
        canvas.height = canvas_height;
    }, [canvas_width, canvas_height]);

    useEffect(() => {
        const div = div_ref.current;
        const canvas = canvas_ref.current;
        if (!div || !canvas) return;
        if (!once) return;
        canvas.width = canvas_width;
        canvas.height = canvas_height;
        const ctx = canvas.getContext("2d")!;
        set_once(false);
        once = false;
        fn_data.set(Option.Some(editor_tools({
            canvas,
            ctx,
            brush_color,
            brush_thickness,
            eraser_thickness,
            layers_arr,
            current_layer,
            undo_stack,
            file_state,
            need_on_end
        })));
        const on_mousemove = (e: MouseEvent) => {
            const canvas_rect = canvas.getBoundingClientRect();
            const [f_x, f_y] = [(e.clientX - canvas_rect.left) / zoom.current, (e.clientY - canvas_rect.top) / zoom.current];
            const [x, y] = [Math.floor(f_x), Math.floor(f_y)];
            const packed = { f_x, f_y, x, y, ctrl: e.ctrlKey, shift: e.shiftKey, zoom: zoom.current }
            const fn = fn_data.val_local().unwrap()[selected_tool.current];
            if (is_mouse_down) {
                if (fn.tool_move) fn.tool_move(packed);
            } else if (div.contains(e.target as Node | null)) {
                if (fn.move) fn.move(packed);
            }
        };
        const on_mousedown = (e: MouseEvent) => {
            if (e.button !== 0) return;
            const canvas_rect = canvas.getBoundingClientRect();
            const [f_x, f_y] = [(e.clientX - canvas_rect.left) / zoom.current, (e.clientY - canvas_rect.top) / zoom.current];
            const [x, y] = [Math.floor(f_x), Math.floor(f_y)];
            const packed = { f_x, f_y, x, y, ctrl: e.ctrlKey, shift: e.shiftKey, zoom: zoom.current }

            const fn = fn_data.val_local().unwrap()[selected_tool.current];
            if (fn.down) fn.down(packed);
            set_mouse_down(true);
        };
        const on_mouseup = (e: MouseEvent) => {
            const canvas_rect = canvas.getBoundingClientRect();
            const [f_x, f_y] = [(e.clientX - canvas_rect.left) / zoom.current, (e.clientY - canvas_rect.top) / zoom.current];
            const [x, y] = [Math.floor(f_x), Math.floor(f_y)];
            const packed = { f_x, f_y, x, y, ctrl: e.ctrlKey, shift: e.shiftKey, was_down: is_mouse_down, zoom: zoom.current }
            const fn = fn_data.val_local().unwrap()[selected_tool.current];
            if (fn.up) fn.up(packed);
            set_mouse_down(false);
        };
        document.addEventListener("mousemove", on_mousemove)
        div.addEventListener("mousedown", on_mousedown);
        document.addEventListener("mouseup", on_mouseup);
        const on_keydown = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement | undefined)?.tagName === "INPUT") return;
            if (!e.ctrlKey) return;
            if (!("acvxyz".includes(e.key))) return;
            file_state.set(_ => ({ saving: _.saving, saved: false, has_file: _.has_file }));
            if ("acvx".includes(e.key)) set_selected_tool_id("select_tool");
            const fns = fn_data.val_local().unwrap();
            if (e.key === "a") {
                e.preventDefault();
                const fn = fns.select_tool.on_ctrl_a;
                if (fn) fn({});
            } else if (e.key === "c") {
                e.preventDefault();
                const fn = fns.select_tool.on_ctrl_c;
                if (fn) fn({});
            } else if (e.key === "v") {
                e.preventDefault();
                const fn = fns.select_tool.on_ctrl_v;
                if (fn) fn({});
            } else if (e.key === "x") {
                e.preventDefault();
                const fn = fns.select_tool.on_ctrl_x;
                if (fn) fn({});
            } else if (e.key === "y") {
                e.preventDefault();
                const fn = fns[selected_tool.current].on_ctrl_y;
                const f = fn ? fn({}) : true;
                if (f) undo_stack.redo().on_some(({ i, r }) => {
                    const layers = layers_arr.val_global()!;
                    const layer = layers[i];
                    const ctx = layer.ctx;
                    ctx.clearRect(r.x, r.y, r.area.width, r.area.height);
                    ctx.drawImage(r.area, r.x, r.y);
                    layer.preview_update();
                    layers_arr.set([...layers]);
                });
            } else if (e.key === "z") {
                e.preventDefault();
                const fn = fns[selected_tool.current].on_ctrl_z;
                const f = fn ? fn({}) : true;
                if (f) undo_stack.undo().on_some(({ i, u }) => {
                    const layers = layers_arr.val_global()!;
                    const layer = layers[i];
                    const ctx = layer.ctx;
                    ctx.clearRect(u.x, u.y, u.area.width, u.area.height);
                    ctx.drawImage(u.area, u.x, u.y);
                    layer.preview_update();
                    layers_arr.set([...layers]);
                });
            }
        }
        document.addEventListener("keydown", on_keydown);
        return () => {
            document.removeEventListener("mousemove", on_mousemove)
            div.removeEventListener("mousedown", on_mousedown);
            document.removeEventListener("mouseup", on_mouseup);
            document.removeEventListener("keydown", on_keydown)
        }
    }, []);

    return (
        <div
            ref={div_ref}
            style={{
                position: "absolute",
                margin: 0,
                width: "100%",
                height: "100%",
                userSelect: "none",
            }}>
            <canvas
                ref={canvas_ref}
                className="has_own_context_menu"
                onContextMenu={e => { e.preventDefault() }}
                style={{
                    position: "absolute",
                    left: (-0.5 * canvas_width * z) + (0.5 * area_width) - (scroll_horizontal * canvas_width * z),
                    top: (-0.5 * canvas_height * z) + (0.5 * area_height) - (scroll_vertical * canvas_height * z),
                    width: canvas_width * z,
                    height: canvas_height * z,
                    imageRendering: "pixelated",
                    userSelect: "none",
                }} />
        </div>
    )
}

