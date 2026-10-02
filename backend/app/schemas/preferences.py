from typing import List, Literal

from pydantic import BaseModel, ConfigDict

# Avisos do sino são só de prazo (GLOSSARY.md: "Aviso"). "Sem categoria" é
# fila de classificação e mora em "A revisar", não aqui.
TipoAviso = Literal["em_atraso", "a_vencer"]

# Dias à frente além de hoje: 0 é só hoje, 7 vai até hoje + 7. "Só vencidos"
# não existe — é o mesmo que desligar o "a vencer".
JanelaAVencer = Literal[0, 1, 3, 7, 15]


class ParVisto(BaseModel):
    """Um lançamento num aviso, no momento do último "marcar como visto"."""

    aviso: TipoAviso
    transaction_id: int


class PreferencesUpdate(BaseModel):
    """
    Gravação parcial: só o que vier preenchido muda — mexer na janela não
    apaga o visto. `visto` substitui o conjunto inteiro (é o retrato do
    último "marcar como visto"), e o dono vem da rota, nunca do corpo.
    """

    model_config = ConfigDict(extra="ignore")

    em_atraso: bool | None = None
    a_vencer: bool | None = None
    janela_a_vencer: JanelaAVencer | None = None
    visto: List[ParVisto] | None = None
