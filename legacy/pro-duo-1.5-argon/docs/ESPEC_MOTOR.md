# 📐 Especificação Matemática e Hidráulica do Motor (`irriga-core.js` & `main.cpp`)

> **Versão:** `Irriga.ai Pro-Duo v1.5-Argon` (Arquitetura Claude + Execução Argon)
> **Local de referência:** São Vicente do Seridó – PB (`lat: -6.95325, lon: -36.36853`, Clima Semiárido `BSh`)

---

## 1. Balanço Hídrico do Solo FAO-56 ("Modelo do Balde")

Em vez de aplicar uma lâmina fixa todo dia, cada zona de plantio modela a camada de solo explorada pelas raízes como um reservatório ("balde") medido em milímetros ($1\text{ mm} = 1\text{ L/m}^2$):

1. **Água Disponível Total no Bulbo Úmido ($\text{TAW}$):**
   $$\text{TAW} = \text{TAW}_{\text{solo}} \cdot Z_r(\text{DAP}) \cdot f_w$$
   - $\text{TAW}_{\text{solo}} \in \{70, 100, 140, 170\}\text{ mm/m}$ (Arenoso, Franco-arenoso, Franco, Argiloso).
   - $Z_r(\text{DAP})$: profundidade efetiva da raiz no dia $\text{DAP}$, interpolada linearmente de $Z_{r,\min}$ até $Z_{r,\max}$ durante as fases inicial e de desenvolvimento ($L_{\text{ini}} + L_{\text{dev}}$).
   - $f_w = \min\!\left(1,\; \frac{w_{\text{faixa}}}{\text{espaçamento entre linhas abertas}}\right)$: fração da área efetivamente molhada pelas fitas gotejadoras.

2. **Água Facilmente Disponível sem Estresse ($\text{RAW}$):**
   $$\text{RAW} = p \cdot \text{TAW}$$
   onde $p$ é a fração de esgotamento permissível da cultura (FAO-56 Tabela 22).

3. **Evapotranspiração da Cultura Localizada no Gotejo ($\text{ET}_c$):**
   $$\text{ET}_c = \text{ET}_0 \cdot K_c(\text{DAP}) \cdot K_r(\text{DAP}) \cdot f_{\text{palhada}} \cdot \left(1 + \frac{\text{ajuste\_fino}}{100}\right)$$
   - $K_c(\text{DAP})$: curva contínua de 4 estágios FAO-56 ($K_{c,\text{ini}}$, rampa até $K_{c,\text{mid}}$, patamar $K_{c,\text{mid}}$, rampa até $K_{c,\text{end}}$).
   - $K_r(\text{DAP}) = \text{clamp}(0{,}10 + f_{\text{cobertura}}(\text{DAP}),\; 0{,}15,\; 1{,}00)$: fator de localização Keller & Decroix para gotejamento (muda pequena não transpira como dossel fechado).
   - $f_{\text{palhada}} = 0{,}85$ nas fases 0–1 e $0{,}95$ nas demais quando há cobertura morta no solo.

4. **Passo Diário de Esgotamento ($D_r$):**
   $$D_r^+ = \min\!\Big(\text{TAW},\; \max\!\big(0,\; D_r - I_{\text{líq}} - P_{\text{ef}}\big) + \text{ET}_c \cdot K_s\Big)$$
   onde $P_{\text{ef}} = \max(0,\; 0{,}8\cdot(P - 2))$ é a chuva efetivamente infiltrada e $K_s = \text{clamp}\!\left(\frac{\text{TAW} - D_r}{\text{TAW} - \text{RAW}}, 0, 1\right)$ é o coeficiente de estresse hídrico.

---

## 2. Rateio de Água Escassa por Sensibilidade $K_y$ (FAO-33)

Quando a soma dos pedidos das zonas supera a cota diária (ou o volume útil acima da reserva de $25\%$ da caixa de $5.000\text{ L}$):
1. O pedido de cada zona em escassez é limitado a $1{,}2 \times \text{consumo diário}$ (evita espiral de dívida atrasada).
2. Todas as zonas recebem um piso mínimo ($\le 40\%$) e o saldo disponível é alocado por ordem decrescente de sensibilidade produtiva $K_y$ (FAO-33) da fase atual:
   $$1 - \frac{Y_a}{Y_m} = K_y \cdot \left(1 - \frac{\text{ET}_a}{\text{ET}_c}\right)$$
   Assim, uma zona em floração ou início de tuberização ($K_y \ge 1{,}0$) é protegida prioritariamente em relação a uma zona vegetativa ou em maturação ($K_y \approx 0{,}3$).

---

## 3. Hidráulica por Gravidade ($q = k \cdot H^{0,5}$), Janela Elástica e Guarda Térmica

1. **Vazão por Orifício Não-Compensado:**
   $$q(H) = q_{\text{nom}} \cdot \left(\frac{H}{H_{\text{ref}}}\right)^{0,5}, \quad q_{\text{nom}} = 1{,}6\text{ L/h a } H_{\text{ref}} = 10\text{ m.c.a.}$$
   Sob gravidade pura ($H \approx 1{,}8\text{ m.c.a.}$), cada gotejador a cada $30\text{ cm}$ entrega $\sim 0{,}68\text{ L/h}$. Quando o Sensor Hall `SF1` mede a vazão real $Q_{\text{med}}$ ($\text{L/min}$), o sistema resolve a equação inversa para descobrir a carga efetiva $H_{\text{ef}}$ nos gotejadores e crava o tempo exato de abertura da válvula.
2. **Janela Elástica em Pulsos Intercalados (Anti-Colisão no Filtro 120 Mesh):**
   - Nunca abre Zona 1 e Zona 2 juntas.
   - Divide regas longas em pulsos de até $90\text{ min}$ intercalados com $5\text{ min}$ de intervalo e recua automaticamente o início na madrugada para que tudo termine às `05:30` (alvorada).
3. **Guarda Térmica (09:30–16:30):**
   - O volume interno parado na mangueira preta de PEBD $16\text{ mm}$ é $V_{\text{tubo}} \approx 0{,}145\text{ L/m} \times L_{\text{aberta}} + V_{\text{manifold}}$ ($\sim 12\text{ a }15\text{ L}$), que atinge $\sim 50^\circ\text{C}$ sob o sol do Seridó.
   - Entre `09:30` e `16:30`, nenhuma rega menor que $5 \times V_{\text{tubo}}$ é permitida (para que a água quente represente $< 20\%$ da dose total); pulsos menores aguardam as `17:15` (crepúsculo).
