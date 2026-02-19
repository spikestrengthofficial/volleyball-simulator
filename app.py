import numpy as np
import plotly.graph_objects as go
import streamlit as st

G = 9.81
COURT_LENGTH = 18.0
COURT_WIDTH = 9.0
ANTENNA_HEIGHT_ABOVE_NET = 0.8


def _set_hnet_from_preset() -> None:
    preset_map = {
        "Men (2.43 m)": 2.43,
        "Women (2.24 m)": 2.24,
    }
    st.session_state["hnet"] = preset_map[st.session_state["net_preset"]]


def get_inputs() -> dict:
    st.sidebar.header("Simulation Controls")

    if "hnet" not in st.session_state:
        st.session_state["hnet"] = 2.43

    st.sidebar.selectbox(
        "Net Height Preset",
        options=["Men (2.43 m)", "Women (2.24 m)"],
        key="net_preset",
        on_change=_set_hnet_from_preset,
    )

    xs = st.sidebar.slider("S.x (m)", -9.0, 9.0, -6.0, 0.1)
    ys = st.sidebar.slider("S.y (m)", 0.0, 9.0, 4.5, 0.1)
    zs = st.sidebar.slider("S.z (m)", 0.0, 5.0, 2.2, 0.1)

    speed = st.sidebar.slider("Speed |v0| (m/s)", 1.0, 40.0, 15.0, 0.1)
    theta_deg = st.sidebar.slider("Theta elevation (deg)", -20.0, 80.0, 25.0, 0.5)
    phi_deg = st.sidebar.slider("Phi azimuth (deg)", -180.0, 180.0, 0.0, 1.0)

    t_end = st.sidebar.slider("t_end (s)", 0.5, 8.0, 3.0, 0.1)
    dt = st.sidebar.slider("dt (s)", 0.005, 0.1, 0.02, 0.005, format="%.3f")

    hnet = st.sidebar.slider(
        "Net Height Hnet (m)",
        2.0,
        2.7,
        float(st.session_state["hnet"]),
        0.01,
        key="hnet",
    )

    return {
        "S": np.array([xs, ys, zs], dtype=float),
        "speed": float(speed),
        "theta_deg": float(theta_deg),
        "phi_deg": float(phi_deg),
        "t_end": float(t_end),
        "dt": float(dt),
        "hnet": float(hnet),
    }


def velocity_from_angles(speed: float, theta_deg: float, phi_deg: float) -> np.ndarray:
    theta = np.deg2rad(theta_deg)
    phi = np.deg2rad(phi_deg)
    vx = speed * np.cos(theta) * np.cos(phi)
    vy = speed * np.cos(theta) * np.sin(phi)
    vz = speed * np.sin(theta)
    return np.array([vx, vy, vz], dtype=float)


def simulate_trajectory(S: np.ndarray, v0: np.ndarray, t_end: float, dt: float) -> tuple[np.ndarray, np.ndarray]:
    t = np.arange(0.0, t_end + dt, dt)
    g_vec = np.array([0.0, 0.0, -G], dtype=float)
    r = S + np.outer(t, v0) + 0.5 * np.outer(t**2, g_vec)
    return t, r


def compute_apex(S: np.ndarray, v0: np.ndarray) -> tuple[float, np.ndarray]:
    vz0 = v0[2]
    t_apex = max(0.0, vz0 / G)
    g_vec = np.array([0.0, 0.0, -G], dtype=float)
    apex = S + v0 * t_apex + 0.5 * g_vec * (t_apex**2)
    return t_apex, apex


def make_court_traces(hnet: float) -> list[go.Scatter3d]:
    half_len = COURT_LENGTH / 2.0
    width = COURT_WIDTH
    traces: list[go.Scatter3d] = []

    boundary_x = [-half_len, half_len, half_len, -half_len, -half_len]
    boundary_y = [0.0, 0.0, width, width, 0.0]
    boundary_z = [0.0] * len(boundary_x)
    traces.append(
        go.Scatter3d(
            x=boundary_x,
            y=boundary_y,
            z=boundary_z,
            mode="lines",
            name="Court Boundary",
            line={"color": "royalblue", "width": 6},
        )
    )

    traces.append(
        go.Scatter3d(
            x=[0.0, 0.0],
            y=[0.0, width],
            z=[0.0, 0.0],
            mode="lines",
            name="Net Line (floor)",
            line={"color": "gray", "width": 5},
        )
    )

    traces.append(
        go.Scatter3d(
            x=[0.0, 0.0],
            y=[0.0, width],
            z=[hnet, hnet],
            mode="lines",
            name="Net Top",
            line={"color": "black", "width": 7},
        )
    )

    for y_val, label in [(0.0, "Antenna y=0"), (width, "Antenna y=9")]:
        traces.append(
            go.Scatter3d(
                x=[0.0, 0.0],
                y=[y_val, y_val],
                z=[hnet, hnet + ANTENNA_HEIGHT_ABOVE_NET],
                mode="lines",
                name=label,
                line={"color": "red", "width": 8},
            )
        )

    return traces


def build_figure(r: np.ndarray, apex: np.ndarray, hnet: float) -> go.Figure:
    fig = go.Figure()

    for tr in make_court_traces(hnet):
        fig.add_trace(tr)

    fig.add_trace(
        go.Scatter3d(
            x=r[:, 0],
            y=r[:, 1],
            z=r[:, 2],
            mode="lines",
            name="Trajectory",
            line={"color": "orange", "width": 8},
        )
    )

    fig.add_trace(
        go.Scatter3d(
            x=[r[0, 0]],
            y=[r[0, 1]],
            z=[r[0, 2]],
            mode="markers",
            name="Start S",
            marker={"size": 6, "color": "green"},
        )
    )

    fig.add_trace(
        go.Scatter3d(
            x=[apex[0]],
            y=[apex[1]],
            z=[apex[2]],
            mode="markers",
            name="Apex",
            marker={"size": 7, "color": "magenta", "symbol": "diamond"},
        )
    )

    fig.update_layout(
        scene={
            "xaxis": {"title": "x (m)", "range": [-9, 9]},
            "yaxis": {"title": "y (m)", "range": [0, 9]},
            "zaxis": {"title": "z (m)", "range": [0, max(6.0, float(np.max(r[:, 2])) + 1.0)]},
            "aspectmode": "data",
        },
        margin={"l": 0, "r": 0, "b": 0, "t": 35},
        legend={"x": 0.01, "y": 0.99},
        title="3D Volleyball Court Simulator",
    )
    return fig


def main() -> None:
    st.set_page_config(page_title="vb3d_sim", layout="wide")
    st.title("vb3d_sim")
    st.caption("No-aerodynamic ball flight: r(t) = S + v0 t + 0.5 g t^2")

    params = get_inputs()
    v0 = velocity_from_angles(params["speed"], params["theta_deg"], params["phi_deg"])
    t, r = simulate_trajectory(params["S"], v0, params["t_end"], params["dt"])
    t_apex, apex = compute_apex(params["S"], v0)

    fig = build_figure(r, apex, params["hnet"])
    st.plotly_chart(fig, use_container_width=True)

    col1, col2, col3 = st.columns(3)
    col1.metric("Apex Time (s)", f"{t_apex:.3f}")
    col2.metric("滞空时间 (to apex, s)", f"{t_apex:.3f}")
    col3.metric("Apex z (m)", f"{apex[2]:.3f}")

    st.write(
        {
            "apex_coordinate": {
                "x": float(apex[0]),
                "y": float(apex[1]),
                "z": float(apex[2]),
            },
            "num_samples": int(t.size),
            "v0": {
                "vx": float(v0[0]),
                "vy": float(v0[1]),
                "vz": float(v0[2]),
            },
        }
    )


if __name__ == "__main__":
    main()
