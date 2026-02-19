import numpy as np
import plotly.graph_objects as go
import streamlit as st

# =========================
# Constants / Coordinates
# =========================
# Origin: net center
# x: -9 (our endline) -> +9 (opponent endline)
# y: -4.5 (left sideline) -> +4.5 (right sideline)
# z: vertical
X_MIN, X_MAX = -9.0, 9.0
Y_MIN, Y_MAX = -4.5, 4.5
Z_MIN, Z_MAX = 0.0, 5.0

COURT_LENGTH = 18.0
COURT_WIDTH = 9.0
ATTACK_LINE_X = 3.0

NET_HEIGHTS = {"Men (2.43m)": 2.43, "Women (2.24m)": 2.24}
POLE_OFFSET = 0.5
POLE_HEIGHT = 2.55
ANTENNA_ABOVE_NET = 0.8

G = 9.81
G_VEC = np.array([0.0, 0.0, -G], dtype=float)

AXIS_RANGES = {
    "x": [X_MIN, X_MAX],
    "y": [Y_MIN, Y_MAX],
    "z": [Z_MIN, Z_MAX],
}
ASPECT_RATIO = {"x": 18, "y": 9, "z": 5}

CAMERA_BROADCAST = {
    "eye": {"x": 1.8, "y": 1.25, "z": 0.85},
    "center": {"x": 0.0, "y": 0.0, "z": -0.08},
    "up": {"x": 0.0, "y": 0.0, "z": 1.0},
}


def draw_court(fig: go.Figure) -> None:
    corners = np.array(
        [
            [-9.0, -4.5, 0.0],
            [-9.0, +4.5, 0.0],
            [+9.0, +4.5, 0.0],
            [+9.0, -4.5, 0.0],
            [-9.0, -4.5, 0.0],
        ],
        dtype=float,
    )

    fig.add_trace(
        go.Scatter3d(
            x=corners[:, 0],
            y=corners[:, 1],
            z=corners[:, 2],
            mode="lines",
            line={"color": "#1e2a30", "width": 4},
            name="Court boundary",
        )
    )

    # Centerline under net
    fig.add_trace(
        go.Scatter3d(
            x=[0.0, 0.0],
            y=[Y_MIN, Y_MAX],
            z=[0.0, 0.0],
            mode="lines",
            line={"color": "#4f616b", "width": 3},
            name="Centerline",
        )
    )

    # Attack lines at x = +/-3
    for x_val, label in [(-ATTACK_LINE_X, "Attack line own"), (ATTACK_LINE_X, "Attack line opp")]:
        fig.add_trace(
            go.Scatter3d(
                x=[x_val, x_val],
                y=[Y_MIN, Y_MAX],
                z=[0.0, 0.0],
                mode="lines",
                line={"color": "#6b7f88", "width": 2},
                name=label,
            )
        )


def draw_net(fig: go.Figure, h_net: float) -> None:
    # Net surface at x=0
    y_vals = np.linspace(Y_MIN, Y_MAX, 24)
    z_vals = np.linspace(0.0, h_net, 16)
    Y, Z = np.meshgrid(y_vals, z_vals)
    X = np.zeros_like(Y)

    fig.add_trace(
        go.Surface(
            x=X,
            y=Y,
            z=Z,
            opacity=0.22,
            showscale=False,
            colorscale=[[0.0, "#e6edf2"], [1.0, "#e6edf2"]],
            hoverinfo="skip",
            name="Net",
        )
    )

    # Net top tape
    fig.add_trace(
        go.Scatter3d(
            x=[0.0, 0.0],
            y=[Y_MIN, Y_MAX],
            z=[h_net, h_net],
            mode="lines",
            line={"color": "#101010", "width": 5},
            name="Net top",
        )
    )

    # Poles at y = +/- (4.5 + 0.5)
    for y_pole, label in [(-(4.5 + 0.5), "Pole L"), ((4.5 + 0.5), "Pole R")]:
        fig.add_trace(
            go.Scatter3d(
                x=[0.0, 0.0],
                y=[y_pole, y_pole],
                z=[0.0, POLE_HEIGHT],
                mode="lines",
                line={"color": "#666666", "width": 6},
                name=label,
            )
        )

    # Antennae at y = +/-4.5, from Hnet to Hnet+0.8
    for y_ant, label in [(-4.5, "Antenna L"), (4.5, "Antenna R")]:
        fig.add_trace(
            go.Scatter3d(
                x=[0.0, 0.0],
                y=[y_ant, y_ant],
                z=[h_net, h_net + ANTENNA_ABOVE_NET],
                mode="lines",
                line={"color": "#e53935", "width": 6},
                name=label,
            )
        )


def solve_v0_from_target(S: np.ndarray, P_hit: np.ndarray, t_hit: float) -> np.ndarray:
    return (P_hit - S - 0.5 * G_VEC * (t_hit**2)) / t_hit


def simulate_trajectory(S: np.ndarray, v0: np.ndarray, t_end: float, dt: float) -> tuple[np.ndarray, np.ndarray]:
    t = np.arange(0.0, t_end + dt, dt)
    R = S[None, :] + v0[None, :] * t[:, None] + 0.5 * G_VEC[None, :] * (t[:, None] ** 2)
    return t, R


def velocity_at(v0: np.ndarray, t: float) -> np.ndarray:
    return v0 + G_VEC * t


def compute_legal_spike_envelope(
    P_hit: np.ndarray,
    h_net: float,
    nx: int,
    ny: int,
    k_samples: int,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    x_hit, y_hit, z_hit = P_hit

    xL_vals = np.linspace(0.2, 9.0, nx)
    yL_vals = np.linspace(-4.5, 4.5, ny)
    Xg, Yg = np.meshgrid(xL_vals, yL_vals, indexing="xy")

    xL = Xg.ravel()
    yL = Yg.ravel()

    denom = xL - x_hit
    safe = np.abs(denom) > 1e-10

    s_star = np.empty_like(denom)
    s_star.fill(np.nan)
    s_star[safe] = (0.0 - x_hit) / denom[safe]

    y_cross = y_hit + s_star * (yL - y_hit)
    z_cross = z_hit + s_star * (0.0 - z_hit)

    legal = (
        safe
        & (s_star > 0.0)
        & (s_star < 1.0)
        & (z_cross >= h_net)
        & (y_cross >= -4.5)
        & (y_cross <= 4.5)
    )

    landing_pts = np.zeros((legal.sum(), 3), dtype=float)
    landing_pts[:, 0] = xL[legal]
    landing_pts[:, 1] = yL[legal]
    landing_pts[:, 2] = 0.0

    cross_pts = np.zeros((legal.sum(), 3), dtype=float)
    cross_pts[:, 0] = 0.0
    cross_pts[:, 1] = y_cross[legal]
    cross_pts[:, 2] = z_cross[legal]

    if landing_pts.shape[0] == 0:
        return cross_pts, landing_pts, np.zeros((0, 3), dtype=float)

    s = np.linspace(0.0, 1.0, k_samples)
    d = landing_pts - P_hit[None, :]
    seg = P_hit[None, None, :] + s[None, :, None] * d[:, None, :]
    envelope_pts = seg.reshape(-1, 3)
    return cross_pts, landing_pts, envelope_pts


def validate_scene_config(scene_cfg: dict) -> tuple[bool, str]:
    try:
        assert scene_cfg["aspectmode"] == "manual"
        assert list(scene_cfg["xaxis"]["range"]) == AXIS_RANGES["x"]
        assert list(scene_cfg["yaxis"]["range"]) == AXIS_RANGES["y"]
        assert list(scene_cfg["zaxis"]["range"]) == AXIS_RANGES["z"]
        ar = scene_cfg["aspectratio"]
        assert ar["x"] == ASPECT_RATIO["x"]
        assert ar["y"] == ASPECT_RATIO["y"]
        assert ar["z"] == ASPECT_RATIO["z"]
        return True, "Scene scale config OK"
    except AssertionError as exc:
        return False, f"Scene scale config FAILED: {exc}"


def main() -> None:
    st.set_page_config(layout="wide")
    st.title("3D Volleyball Simulator: Set-to-Contact + Legal Spike Envelope")

    left, right = st.columns([1, 2], gap="large")

    with left:
        st.subheader("Controls")

        net_mode = st.selectbox("Net height", list(NET_HEIGHTS.keys()), index=0)
        h_net = NET_HEIGHTS[net_mode]

        st.markdown("### Setter release S")
        xs = st.slider("xs", -9.0, -0.1, -3.0, 0.1)
        ys = st.slider("ys", -4.5, 4.5, 0.0, 0.05)
        zs = st.slider("zs", 1.5, 3.5, 2.3, 0.01)
        S = np.array([xs, ys, zs], dtype=float)

        st.markdown("### Target contact P_hit (Pos 4 defaults)")
        x_t = st.slider("x_t", -2.5, 1.0, -0.8, 0.05)
        y_t = st.slider("y_t", -4.5, 4.5, 3.8, 0.05)
        z_t = st.slider("z_t", 2.5, 4.0, 3.1, 0.01)
        P_hit = np.array([x_t, y_t, z_t], dtype=float)

        t_hit = st.slider("t_hit (s)", 0.15, 2.0, 0.55, 0.01)

        st.markdown("### Simulation / Envelope")
        t_after = st.slider("extra time after hit (s)", 0.0, 1.0, 0.3, 0.05)
        t_end = t_hit + t_after
        dt = st.select_slider("dt", options=[0.005, 0.01, 0.02, 0.03], value=0.01)

        nx = st.slider("Envelope nx (landing x samples)", 20, 80, 60, 2)
        ny = st.slider("Envelope ny (landing y samples)", 20, 80, 60, 2)
        k_samples = st.slider("Envelope K (points per spike)", 4, 16, 10, 1)

        show_envelope = st.checkbox("Show legal spike 3D envelope", value=True)
        show_hull = st.checkbox("Show optional hull mesh (slow)", value=False)

    with right:
        v0 = solve_v0_from_target(S, P_hit, t_hit)
        t, R = simulate_trajectory(S, v0, t_end, dt)

        # Set segment: 0..t_hit
        set_mask = t <= (t_hit + 1e-9)
        R_set = R[set_mask]

        # Required constraint: stay on our side unless user sets x_t >= 0
        set_crosses_net = bool(np.any(R_set[:, 0] >= 0.0))
        set_constraint_ok = True
        set_constraint_msg = ""
        if x_t < 0.0:
            try:
                assert not set_crosses_net
            except AssertionError:
                set_constraint_ok = False
                set_constraint_msg = "Set segment crosses net before t_hit while x_t<0."

        p_hit_curve = S + v0 * t_hit + 0.5 * G_VEC * (t_hit**2)
        v_hit = velocity_at(v0, t_hit)

        cross_pts, landing_pts, env_pts = compute_legal_spike_envelope(P_hit, h_net, nx, ny, k_samples)

        st.subheader("Debug / Validation")
        st.write(f"Axis ranges (x,y,z): {AXIS_RANGES}")
        st.write(f"Aspect mode: manual")
        st.write(f"Aspect ratio: {ASPECT_RATIO}")
        st.write(f"Set crosses net before t_hit: {set_crosses_net}")
        st.write(f"Legal spikes count: {landing_pts.shape[0]}")
        st.write(f"Envelope point count: {env_pts.shape[0]}")

        st.subheader("Set Metrics")
        st.write(f"Target Contact P_hit = ({P_hit[0]:.3f}, {P_hit[1]:.3f}, {P_hit[2]:.3f})")
        st.write(f"Trajectory at t_hit = ({p_hit_curve[0]:.3f}, {p_hit_curve[1]:.3f}, {p_hit_curve[2]:.3f})")
        st.write(f"|v(t_hit)| = {np.linalg.norm(v_hit):.3f} m/s")
        st.write(f"Flight time = t_hit = {t_hit:.3f} s")

        fig = go.Figure()
        draw_court(fig)
        draw_net(fig, h_net)

        fig.add_trace(
            go.Scatter3d(
                x=R_set[:, 0],
                y=R_set[:, 1],
                z=R_set[:, 2],
                mode="lines",
                line={"color": "#ff8c00", "width": 6},
                name="Set trajectory (0..t_hit)",
            )
        )

        if t_after > 0:
            R_after = R[~set_mask]
            if R_after.shape[0] > 1:
                fig.add_trace(
                    go.Scatter3d(
                        x=R_after[:, 0],
                        y=R_after[:, 1],
                        z=R_after[:, 2],
                        mode="lines",
                        line={"color": "#ffb870", "width": 3, "dash": "dot"},
                        name="Post-hit extrapolation",
                    )
                )

        fig.add_trace(
            go.Scatter3d(
                x=[S[0]],
                y=[S[1]],
                z=[S[2]],
                mode="markers",
                marker={"size": 6, "color": "#2ca02c"},
                name="Setter release S",
            )
        )

        # Contact point highlight (required)
        fig.add_trace(
            go.Scatter3d(
                x=[P_hit[0]],
                y=[P_hit[1]],
                z=[P_hit[2]],
                mode="markers+text",
                marker={"size": 14, "color": "#ff1744", "symbol": "diamond"},
                text=["Contact P_hit"],
                textposition="top center",
                name="Contact P_hit",
            )
        )

        # Ball at t_hit (same point, larger)
        fig.add_trace(
            go.Scatter3d(
                x=[p_hit_curve[0]],
                y=[p_hit_curve[1]],
                z=[p_hit_curve[2]],
                mode="markers",
                marker={"size": 18, "color": "#ffd54f", "line": {"color": "#111", "width": 1}},
                name="Ball at t_hit",
            )
        )

        # Net-plane legal crossing points
        if cross_pts.shape[0] > 0:
            fig.add_trace(
                go.Scatter3d(
                    x=cross_pts[:, 0],
                    y=cross_pts[:, 1],
                    z=cross_pts[:, 2],
                    mode="markers",
                    marker={
                        "size": 2,
                        "color": cross_pts[:, 2],
                        "colorscale": "Turbo",
                        "opacity": 0.8,
                        "cmin": h_net,
                        "cmax": 5.0,
                        "colorbar": {"title": "z_cross", "len": 0.45},
                    },
                    name="Legal net crossings",
                )
            )

        # 3D envelope shape as translucent point cloud volume
        if show_envelope and env_pts.shape[0] > 0:
            fig.add_trace(
                go.Scatter3d(
                    x=env_pts[:, 0],
                    y=env_pts[:, 1],
                    z=env_pts[:, 2],
                    mode="markers",
                    marker={
                        "size": 1.6,
                        "color": env_pts[:, 0],
                        "colorscale": "Viridis",
                        "opacity": 0.08,
                        "showscale": False,
                    },
                    name="Legal spike envelope (3D)",
                )
            )

        if show_hull and env_pts.shape[0] > 100:
            fig.add_trace(
                go.Mesh3d(
                    x=env_pts[:, 0],
                    y=env_pts[:, 1],
                    z=env_pts[:, 2],
                    alphahull=6,
                    opacity=0.12,
                    color="#26a69a",
                    name="Envelope hull",
                )
            )

        scene_cfg = {
            "xaxis": {"title": "x (m)", "range": AXIS_RANGES["x"]},
            "yaxis": {"title": "y (m)", "range": AXIS_RANGES["y"]},
            "zaxis": {"title": "z (m)", "range": AXIS_RANGES["z"]},
            "aspectmode": "manual",
            "aspectratio": ASPECT_RATIO,
            "camera": CAMERA_BROADCAST,
        }

        fig.update_layout(
            scene=scene_cfg,
            margin={"l": 0, "r": 0, "t": 10, "b": 0},
            height=800,
            legend={"x": 0.01, "y": 0.99},
        )

        scene_ok, scene_msg = validate_scene_config(scene_cfg)
        if not scene_ok:
            st.warning(scene_msg)
        if not set_constraint_ok:
            st.warning(set_constraint_msg)

        st.plotly_chart(fig, use_container_width=True)


if __name__ == "__main__":
    main()
