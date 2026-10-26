# Brida escalonada de sujecion para mesa de ranura T, perno M12.
# Barra con ranura corrida para el esparrago: un extremo pisa la pieza y el
# otro se apoya en un bloque escalonado. Acero 1018 o 4140.
from cadgen import build123d as bd
from cadgen import step, stl

LARGO = 125.0
ANCHO = 32.0
ESPESOR = 16.0
RANURA_ANCHO = 14.0     # paso holgado para esparrago M12
RANURA_LARGO = 78.0     # recorrido util del esparrago
TALON = 10.0            # altura del talon que pisa la pieza
TALON_LARGO = 18.0
RAMPA = 20.0            # rebaje inclinado del lado del bloque escalonado
CHAFLAN = 1.5


@step(out="../STEP/brida-escalonada-m12.step")
@stl(out="../STL/brida-escalonada-m12.stl", mesh_tolerance=4e-4)
def brida_escalonada_m12():
    cuerpo = bd.Box(
        LARGO, ANCHO, ESPESOR,
        align=(bd.Align.CENTER, bd.Align.CENTER, bd.Align.MIN),
    )

    # Ranura corrida y pasante para el esparrago.
    ranura = bd.extrude(
        bd.SlotOverall(RANURA_LARGO, RANURA_ANCHO).face(), amount=ESPESOR
    )
    cuerpo -= ranura

    # Talon de apoyo: se rebaja todo el extremo menos la nariz que pisa.
    rebaje = bd.Box(
        LARGO / 2 - TALON_LARGO, ANCHO, TALON,
        align=(bd.Align.MAX, bd.Align.CENTER, bd.Align.MIN),
    ).moved(bd.Location((LARGO / 2 - TALON_LARGO, 0, 0)))
    cuerpo -= rebaje

    # Rampa del lado del bloque escalonado, para que asiente plano al apretar.
    with bd.BuildPart() as cuna:
        with bd.BuildSketch(bd.Plane.XZ) as perfil:
            with bd.BuildLine():
                bd.Polyline(
                    (-LARGO / 2, 0),
                    (-LARGO / 2 + RAMPA, 0),
                    (-LARGO / 2, TALON),
                    close=True,
                )
            bd.make_face()
        bd.extrude(amount=ANCHO, both=True)
    cuerpo -= cuna.part

    cuerpo = bd.chamfer(
        cuerpo.edges().filter_by(bd.Axis.Z).group_by(bd.Axis.X)[0]
        + cuerpo.edges().filter_by(bd.Axis.Z).group_by(bd.Axis.X)[-1],
        CHAFLAN,
    )
    cuerpo.label = "brida-escalonada-m12"
    return cuerpo


if __name__ == "__main__":
    brida_escalonada_m12()
