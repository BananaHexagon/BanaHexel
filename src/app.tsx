import { useEffect } from "react";
import { LayerArea } from "./layer_area";
import { WorkSpace } from "./workspace";
import { Option, Result, State, UnRequired } from "./common/utils";
import { ProjectLoading } from "./project_loading";
import { atom, useRecoilState, useSetRecoilState } from "recoil";
import { Layer } from "./data";
import { binary_to_bitmap, data_fileT, user_dataT } from "./file";
import { file_save_state } from "./title_bar";

export const user_data_state = atom({
    key: "user_data_state_atom",
    default: Option.None<user_dataT>()
})

export const layer_arr_state = atom<Layer[] | undefined>({
    key: "layer_arr_state_atom",
    default: undefined
})

export const current_layer_state = atom({
    key: "current_layer_state_atom",
    default: 0
})

export const canvas_size_state = atom<{ width: number, height: number } | undefined>({
    key: "canvas_size_state_atom",
    default: undefined
})

export const is_loading_state = atom<boolean>({
    key: "is_loading_state_atom",
    default: true,
})

export const opening_file_path_state = atom<Option<string>>({
    key: "opening_file_path_state_atom",
    default: Option.None(),
})

export const load_file = async (data: UnRequired<data_fileT, "layers">, setters: {
    set_layer_arr: (arg0: Layer[]) => void,
    set_canvas_size: (arg0: { width: number, height: number }) => void,
    set_loading: (arg0: boolean) => void,
    set_current_layer: (arg0: number | ((arg0: number) => number)) => void,
}) => {
    const promises: Promise<Result<CanvasImageSource, unknown>>[] = [];
    if (data.layers !== undefined) data.layers.forEach((a) => promises.push(binary_to_bitmap(a)))
    await Promise.all(promises);
    const layers: Layer[] = [];

    if (data.layers === undefined) {
        layers.push(new Layer(undefined, data.meta_data.canvas_size))
    } else for (let i = 0; i < data.layers.length; i++) {
        const bitmap = (await promises[i]).unwrap();
        layers.push(new Layer(bitmap, data.meta_data.canvas_size))
    }
    setters.set_layer_arr(layers);
    setters.set_canvas_size(data.meta_data.canvas_size);
    setters.set_loading(false);
    setters.set_current_layer(_ => Math.min(_, layers.length - 1))
}

export const App = () => {
    const [is_loading, set_loading] = useRecoilState(is_loading_state);
    const set_current_layer = useSetRecoilState(current_layer_state);
    const set_layer_arr = useSetRecoilState(layer_arr_state);
    const set_canvas_size = useSetRecoilState(canvas_size_state);
    const set_opening_file_path = useSetRecoilState(opening_file_path_state);
    const file_state = new State(useRecoilState(file_save_state));
    useEffect(() => {
        (async () => {
            set_opening_file_path(Option.None());
            set_loading(true);
            await load_file({
                meta_data: {
                    canvas_size: {
                        width: 64,
                        height: 64,
                    },
                },
            }, { set_canvas_size, set_layer_arr, set_loading, set_current_layer });
            file_state.set({ saving: false, saved: false, has_file: false })
        })()
    }, [])

    return (
        !is_loading ? (
            <div id="app">
                <LayerArea />
                <WorkSpace />
            </div>
        ) : (<ProjectLoading />)
    );
}

export default App;
