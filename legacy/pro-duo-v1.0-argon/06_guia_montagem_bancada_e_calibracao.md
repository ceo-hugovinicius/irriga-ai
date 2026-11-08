# 🧰 06 — Guia Prático de Montagem em Bancada, Fiação e Calibração de Campo (`Pro-Duo`)

> **Objetivo deste documento:** Servir como seu checklist prático de montagem quando as peças do carrinho do Mercado Livre chegarem, garantindo zero risco de curto-circuito no **ESP32-WROOM-32D (38 Pinos V4)** e mostrando como calibrar o sensor de vazão `SF1` e as mangueiras de 16 mm no sítio em **São Vicente do Seridó – PB**.

---

## ⚡ 1. Ordem Segura de Montagem na Caixa Hermética (Passo a Passo)

> [!CAUTION]
> **REGRA DE OURO ANTES DE LIGAR NA TOMADA:**
> Nunca ligue o cabo USB do computador no ESP32 ao mesmo tempo em que o pino `5V / VIN` estiver recebendo 5V do conversor Step-Down sem diodo de proteção, ou desligue a fonte 12V quando for gravar o código via USB pela primeira vez.

### Passo 1 — Barramento de Energia (12V DC e 5V DC)
1. **Entrada 220V AC (Rede do Sítio):** Passe pelo **Disjuntor Bipolar 6A** + **DPS Clamper** antes de entrar nos bornes `L` e `N` da **Fonte Chaveada Colmeia 12V 5A (60W)**.
2. **Saída 12V DC da Fonte:**
   - Ligue o positivo `+12V` passando por um **porta-fusível de 3A** até o barramento `+12V` (que alimentará o `VCC` de potência da placa de 8 relés e o comum das 3 válvulas solenoides 12V).
   - Ligue o negativo `-12V (GND)` ao **Barramento Comum de Terra (`GND`)**.
3. **Conversor Step-Down Buck (`12V -> 5V`):**
   - **Importante:** Se o seu módulo Step-Down tiver trimpot (parafuso de ajuste), ligue-o primeiro sozinho no 12V e gire o parafuso medindo com um multímetro até a saída marcar cravados **`5.0V DC`** *antes* de encostar no ESP32!
   - Depois de aferido em `5.0V`, ligue a saída `+5V` no pino **`VIN (5V)`** do ESP32 (e na alimentação de lógica `JD-VCC / VCC` de 5V dos fotoacopladores e no fio vermelho do sensor de vazão `SF1`).

---

### Passo 2 — Diodos Flyback `1N4007` nas 3 Válvulas Solenoides 12V
Quando uma bobina solenoide 12V desliga, ela devolve um pico reverso de até `-80V` pelo fio que faz o ESP32 reiniciar sozinho.
- Em cada uma das **3 válvulas solenoides** (`Válvula Mestre`, `Válvula Zona 1` e `Válvula Zona 2`), prenda um **diodo `1N4007`** em paralelo com os dois fios da válvula:
  - **Faixa prateada do diodo (Catodo)** virada para o fio **Positivo (`+12V` que vem do Relé)**.
  - **Lado preto do diodo (Anodo)** virado para o fio **Negativo (`GND`)**.

---

### Passo 3 — Ligação da Placa de 8 Relés ao ESP32 (38 Pinos V4)

| Canal da Placa de 8 Relés | Pino no ESP32 | O que vai ligado no Borne `NA` (Normalmente Aberto) do Relé | Status no MVP |
| :---: | :---: | :--- | :---: |
| **Relé 1 (`IN1`)** | **`GPIO 4`** | Fio positivo da **Válvula Mestre Geral 12V (`V_MASTER`)** | 🟢 **Ativo MVP** |
| **Relé 2 (`IN2`)** | **`GPIO 16`** | Fio positivo da **Válvula Zona 1 (Oeste • 128 m²)** | 🟢 **Ativo MVP** |
| **Relé 3 (`IN3`)** | **`GPIO 17`** | Fio positivo da **Válvula Zona 2 (Leste • 158 m²)** | 🟢 **Ativo MVP** |
| **Relé 4 (`IN4`)** | **`GPIO 18`** | *Deixar borne livre p/ futura Válvula Zona 3* | 🟡 Reserva Pronta |
| **Relé 5 (`IN5`)** | **`GPIO 19`** | *Deixar borne livre p/ futura Válvula Zona 4* | 🟡 Reserva Pronta |
| **Relé 6 (`IN6`)** | **`GPIO 23`** | *Deixar borne livre p/ futura Bomba Auxiliar 12V* | 🟡 Reserva Pronta |
| **Relé 7 (`IN7`)** | **`GPIO 25`** | *Deixar borne livre p/ futuro Refletor / Luz do Sítio* | 🟡 Reserva Pronta |
| **Relé 8 (`IN8`)** | **`GPIO 5`** | *Deixar borne livre p/ futura Câmera Wi-Fi / Sirene* | 🟡 Reserva Pronta |

---

### Passo 4 — Os 4 Botões Físicos na Tampa da Caixa e as 4 Boias da Caixa d'Água
Nenhum botão e nenhuma boia recebe `+3.3V` ou `+5V`! Todos usam apenas **2 fios**: um pino vai no **`GND`** e o outro vai direto no pino do ESP32 (que já está com `INPUT_PULLUP` ativado no código):

| Componente | Pino 1 | Pino 2 | Função no Sistema |
| :--- | :---: | :---: | :--- |
| **Botão 1 (`⏸️ Pausar`)** | `GND` | **`GPIO 13`** | Pausa todas as irrigações planejadas |
| **Botão 2 (`▶️ Continuar`)** | `GND` | **`GPIO 14`** | Retoma agenda planejada / Troca tela do visor OLED |
| **Botão 3 (`💦 Liga +1h`)** | `GND` | **`GPIO 26`** | Irriga tudo por +1h (+2h, +3h, máx 4h) |
| **Botão 4 (`🌧️ Era bom chover`)** | `GND` | **`GPIO 27`** | Soma +25% (1 clique) ou +50% (2 cliques) por 24h |
| **Boia Reserva (`25%`)** | `GND` | **`GPIO 32`** | Corta irrigação abaixo de 1.250 L na caixa |
| **Boia Meio (`50%`)** | `GND` | **`GPIO 33`** | Libera margem elástica do botão *"Era bom chover"* |
| **Boia Alta (`75%`)** | `GND` | **`GPIO 12`** | Indicador de caixa com folga (3.750 L) |
| **Boia Cheia (`100%`)** | `GND` | **`GPIO 15`** | Caixa de 5.000 L cheia |

---

### Passo 5 — Sensor de Vazão Hall `SF1` (3/4") com Divisor de Tensão
O sensor de vazão trabalha com **5V** (fio vermelho no `+5V`, fio preto no `GND`), mas o fio amarelo de pulso solta **pulsos de 5V**. Para proteger o pino **`GPIO 34`** do ESP32 (`3.3V`):
1. Ligue um resistor de **`10 kΩ`** entre o **fio amarelo do sensor** e o pino **`GPIO 34`**.
2. Ligue um resistor de **`20 kΩ`** (ou dois de `10 kΩ` em série) entre o pino **`GPIO 34`** e o **`GND`**.
*(Isso reduz o pulso de `5.0V` para `3.33V` cravados!)*

---

## 🪣 2. Teste a Seco na Bancada (Antes de Ir para o Sítio)

1. Grave o firmware [`firmware/src/main.cpp`](file:///c:/irriga-ai/pro-duo/firmware/src/main.cpp) no ESP32 via PlatformIO.
2. Ao ligar, você ouvirá **2 bipes curtos** e o visor OLED 0.96" acenderá mostrando `Status: AUTOMATICO`.
3. **Teste dos 4 Botões Físicos:**
   - Aperte o **Botão 1 (`GPIO 13`)**: o Buzzer dá 2 bipes longos e o OLED mostra `Status: PAUSADO [||]`.
   - Aperte o **Botão 2 (`GPIO 14`)**: o Buzzer dá 2 bipes curtos e volta para `Status: AUTOMATICO`.
   - Aperte o **Botão 4 (`GPIO 27`)**: o Buzzer toca a **melodia de gotas de chuva** e o OLED mostra `Chuva Extra: +25% 24h`.
4. **Teste de Soprar no Sensor de Vazão `SF1`:**
   - Aperte o **Botão 3 (`Liga +1h`)**: os LEDs do **Relé 1 (`V_MASTER`)** e do **Relé 2 (`Zona 1`)** vão acender.
   - Sopre com a boca dentro do sensor de vazão `SF1` no sentido da seta: veja no visor OLED a vazão (`L/m`) e os litros (`Cota: X/1000 L`) subindo na hora!
   - Pare de soprar e aguarde **60 segundos** com a válvula aberta: o sistema detectará **`CANO_SECO_OU_SOLENOIDE_PRESA`**, desligará os relés sozinho e apitará 3 vezes comprovando que a trava de segurança está funcionando!

---

## 📏 3. Calibração de 1 Minuto no Campo (Caixa de 5.000 L + Filtro 120 Mesh Limpo)

Quando instalar na saída da caixa de 5.000 L com o **Filtro 120 Mesh limpo**:
1. Abra as **8 linhas de gotejamento** da **Zona 1** (para o plantio do Jerimum) e acione a Zona 1 por **exatos 5 minutos**.
2. Olhe no aplicativo ou no visor OLED quantos litros o sensor `SF1` contou (ou meça em um gotejador com um copo medidor durante 1 minuto e multiplique pelo total de gotejadores abertos).
3. Anote a **Vazão Nominal Limpa (`L/min`)** da Zona 1 e da Zona 2 no aplicativo (ou peça ao Claude atualizar `vazao_nominal_referencia_lpm` no seu YAML). A partir desse momento, o sistema saberá exatamente quando o filtro 120 Mesh começar a sujar!
