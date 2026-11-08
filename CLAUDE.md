# 🌱 CLAUDE.md — Manifesto de Arquitetura, Visão Humana e Guia de Evolução Autoral para o Claude Opus (`Irriga.ai`)

> **MENSAGEM DIRETA PARA O CLAUDE OPUS (CLAUDE CODE / ANTHROPIC):**
> Olá, Claude Opus! Este documento foi preparado especialmente para guiar a criação da **sua versão do sistema Irriga.ai**, partindo da release finalizada **`Irriga.ai Pro-Duo v1.0-Argon`** (localizada em [`pro-duo/`](file:///c:/irriga-ai/pro-duo)) e da especificação de porte máximo **`Irriga.ai Pro-Max`** (em [`pro-max/`](file:///c:/irriga-ai/pro-max)).

---

## 🎯 0. O Propósito da Sua Versão (Por Que Você Está Sendo Chamado Após a `v1.0-Argon`?)

1. **Obter Novas Ideias, Diferentes Execuções e Soluções Superiores:**
   - A versão **`1.0-Argon`** já é um sistema funcional completo (com motor agronômico, simulação de 260 dias, firmware ESP32 C++, PWA Android/iOS, janela elástica de horários e integração YAML).
   - O objetivo de pedir que você (**Claude Opus**) construa a sua versão é **explorar o seu raciocínio profundo para trazer novas ideias, abordagens arquiteturais diferentes e soluções elegantes para desafios reais observados ou previstos na `v1.0-Argon`** (listados na Seção 3 abaixo).
2. **Economia Inteligente de Processamento e Cota (Não Reinvente a Roda à Toa!):**
   - **Regra de Ouro de Eficiência:** Sempre que você analisar um módulo, algoritmo, esquema ou componente da `v1.0-Argon` e concluir que **não há uma solução significativamente melhor**, **você tem total liberdade (e recomendação expressa!) para apenas copiar/reaproveitar a funcionalidade pronta da `v1.0-Argon`**.
   - **Concentre seus tokens e seu poder cognitivo** apenas naquilo em que você realmente puder entregar uma ideia nova, uma execução mais limpa, uma física mais precisa ou uma experiência de usuário superior!
3. **Protocolo Obrigatório Anti-Limite de Uso (Fila de Tarefas & Checkpoints Curtos):**
   - Os limites de uso de IA (cotas de mensagens/tokens do Opus) são curtos. Para **jamais ficar preso em loop ou perder trabalho no meio de um arquivo grande**:
     - **Passo 1 Imediato:** Antes de codificar, crie uma **Fila de Tarefas e Log de Atividades** (ex: `OPUS_CHECKPOINT_LOG.md`, inspirado no [`pro-duo/DEV_LOG_CHECKPOINT.md`](file:///c:/irriga-ai/pro-duo/DEV_LOG_CHECKPOINT.md)).
     - **Passo 2:** Divida o seu trabalho em **checkpoints pequenos, atômicos e autocontidos** (1 a 2 arquivos por etapa).
     - **Passo 3:** Ao concluir cada micro-etapa, salve imediatamente o status no arquivo de log. Assim, se a cota de uso acabar no meio do caminho e o usuário digitar **"Continue"** (ou alternar entre Opus, Sonnet e Gemini), você retoma no segundo exato em que parou sem retrabalho!

---

## 🌟 1. A Alma do Projeto: O Que o Usuário Realmente Almeja

Este sistema foi concebido para um sítio real no **Semiárido Paraibano** (**São Vicente do Seridó – PB**, coordenadas `6°57'11.7"S, 36°22'06.7"W` / `lat: -6.95325, lon: -36.36853`, Clima `BSh`).

Os **6 Valores Centrais** que o usuário busca são:

1. **Qualidade & Simplicidade ("Apple Experience" sob o Sol do Sertão):**
   - **Tema Claro (`Apple Daylight`) como padrão obrigatório**, com contraste impecável para leitura sob luz solar intensa no campo.
   - Zero poluição visual para o usuário final: toda a matemática complexa acontece nos bastidores, traduzida em frases humanas acolhedoras, anéis visuais claros e toques seguros.
2. **Automação Silenciosa em União com o Ser Humano:**
   - O sistema incrementa sozinho a idade da planta (`+1 DAP` à meia-noite), consulta o satélite meteorológico, calcula a evapotranspiração e ajusta as válvulas sem exigir que o humano mexa em sliders.
   - Ao mesmo tempo, mantém uma conexão afetiva e prática com o trabalhador no campo através dos **4 botões físicos na parede** — incluindo o botão lúdico **"Era bom que chovesse"**, que soma um reforço extra de água nas próximas 24 horas quando o agricultor sente que o dia está puxado.
3. **Ubiquidade Total (Botão Físico + Android + iPhone + Computador Remoto):**
   - **O desenvolvedor/dono usa iPhone (iOS) e PC**, mas **os demais usuários no sítio usam celulares Android**.
   - O sistema precisa ser instalável na Tela Inicial tanto no **Android** (Chrome/Samsung via PWA `beforeinstallprompt` + `sw.js`) quanto no **iPhone** (Safari *Add to Home Screen*), abrindo offline na roça.
   - No **Computador (quando o dono está longe da plantação)**, a visão Desktop (*Command Center Remoto*) deve entregar o que agrega valor à distância: **Auditoria de Segurança** (saber se alguém apertou o botão físico de Pausar e esqueceu, saúde do filtro 120 Mesh, travas contra cano seco/vazamento), **Autonomia em dias da caixa de $5.000\text{ L}$** e **Calendário estratégico de viagem/colheita e compra de sementes**.
4. **Eficiência Extrema no Uso da Água:**
   - Caixa d'água de **$5.000\text{ L}$** com cota diária configurável (ex: $1.000\text{ L/dia}$) medida litro a litro pelo Sensor de Vazão Hall `SF1`.
   - Desconto de chuva, janela elástica de horários para minimizar evaporação, corte de $65\%$ nos últimos 10 dias de Melancia/Jerimum para concentrar açúcar ($^\circ\text{Brix}$) e proteção prioritária da zona que estiver em Fase Crítica (Floração/Frutificação).
5. **Ajuda Ativa nas Decisões das Hortas:**
   - Recomendação automática de **Rotação de Culturas** (nunca repetir a mesma família botânica seguida na mesma zona) e plantio escalonado (ex: Jerimum na Zona 1 e Zona 2 com 50 dias de diferença para não acumular estoque na colheita).
6. **Simbiose Direta com o Claude via Arquivo `.YAML` Padronizado:**
   - Botão nativo **"📤 Compartilhar c/ Claude"** (Web Share API no iOS/Android) que anexa o arquivo `plano_irrigacao_sitio.yaml` contendo 100% do estado atual + diagnóstico em tempo real + instruções de perito agrônomo embutidas no próprio YAML.
   - Campo de colagem **vazio por padrão** + opção de **enviar arquivo `.yaml` puro** de volta para aplicar ajustes.

---

## 🔒 2. O Que NÃO Pode Ser Mudado (E o Motivo Físico de Cada Regra)

Estas regras refletem o hardware físico real que será montado na bancada e a hidráulica do terreno:

1. **Pinout do ESP32-WROOM-32D (38 Pinos V4) e Placa de 8 Relés 12V:**
   - Documentado em [`pro-duo/firmware/include/pinout_pro_duo.h`](file:///c:/irriga-ai/pro-duo/firmware/include/pinout_pro_duo.h) e [`pro-duo/02_hidraulica_e_eletrica_simplificada.md`](file:///c:/irriga-ai/pro-duo/02_hidraulica_e_eletrica_simplificada.md).
   - **3 Relés Ativos no MVP:** `Relé 1 (GPIO 4)` = Válvula Mestre | `Relé 2 (GPIO 16)` = Válvula Zona 1 ($128\text{ m}^2$) | `Relé 3 (GPIO 17)` = Válvula Zona 2 ($158\text{ m}^2$).
   - **5 Relés Já Contabilizados na Arquitetura para Expansão:** `Relé 4 (GPIO 18)` = Zona 3 | `Relé 5 (GPIO 19)` = Zona 4 | `Relé 6 (GPIO 23)` = Bomba Auxiliar 12V | `Relé 7 (GPIO 25)` = Iluminação/Refletor | `Relé 8 (GPIO 5)` = Câmera/Acessório.
   - **Sensores e Painel:** Sensor de Vazão Hall `SF1` (`GPIO 34`) | 4 Botões Físicos `INPUT_PULLUP` (`GPIOs 13, 14, 26, 27`) | 4 Boias da Caixa (`GPIOs 32, 33, 12, 15`) | Display OLED I2C (`GPIOs 21, 22`) | Buzzer (`GPIO 2`) | ADC Extras (`GPIOs 35, 36, 39`).
2. **Filtro Único de Disco 120 Mesh & Regra Anti-Colisão de Zonas:**
   - O `Pro-Duo` **não tem duplo filtro autolimpante**; usa um único filtro 120 Mesh por gravidade.
   - **Nunca abra a Zona 1 e a Zona 2 ao mesmo tempo.** Elas devem sempre operar em fila (uma após a outra) para manter pressão máxima nas fitas gotejadoras, e a Válvula Mestre (`Relé 1`) deve abrir junto com qualquer zona e fechar no repouso.
3. **Cadeado Digital no Cabeçalho (`🔒`) vs. Autoridade Imediata dos Botões Físicos:**
   - O App sempre abre travado (`🔒`) para impedir edições acidentais nas zonas. Os 4 botões digitais na tela pedem confirmação antes de executar. Já os 4 botões físicos na caixa do hardware (`GPIOs 13, 14, 26, 27`) **nunca são travados pelo cadeado do App** e agem na hora.
4. **Duas Interfaces Separadas (`index.html` vs. `dev-gui.html`):**
   - `index.html`: Exclusiva para o usuário final (limpa, sem sliders manuais de simulação).
   - `dev-gui.html`: Bancada de engenharia para simular datas, secas, filtro sujo e testar os 8 relés.

---

## 🧪 3. Problemas e Desafios Reais Observados na `v1.0-Argon` (Para o Opus Explorar e Resolver!)

Aqui estão os problemas práticos mais interessantes discutidos na `v1.0-Argon` onde novas ideias do **Claude Opus** serão muito bem-vindas:

### Desafio A: A Física Real da Vazão nas Mangueiras Gotejadoras (`30 cm` • `1,6 L/h por furo`) sob Gravidade
- **A Dúvida Real de Campo:** As mangueiras compradas têm furos a cada **$30\text{ cm}$** com vazão nominal de **$1,6\text{ L/h}$ POR FURO** (o que equivale a $3,33\text{ furos/metro} \times 1,6\text{ L/h} = \mathbf{5,33\text{ L/h por metro linear}}$ quando pressurizadas a $10\text{ m.c.a.}$ / $1\text{ bar}$).
  - Na **Zona 1 ($128\text{ m}^2$, 16 linhas de $8\text{ m}$)**: Com 8 linhas abertas ($64\text{ m} = 213\text{ furos}$), a vazão nominal a $10\text{ mca}$ seria $341\text{ L/h}$ ($5,7\text{ L/min}$); com todas as 16 linhas abertas ($128\text{ m} = 426\text{ furos}$), seria $682\text{ L/h}$ ($11,4\text{ L/min}$).
  - **PORÉM, na gravidade pura da caixa de $5.000\text{ L}$ (sem bomba, altura de $1,5\text{ a }2,5\text{ m.c.a.}$):** Como a vazão de um orifício não-compensado cai com a raiz quadrada da pressão ($Q \propto \sqrt{H}$), cada furo de $1,6\text{ L/h}$ entrega na prática cerca de **$0,60\text{ a }0,80\text{ L/h por furo}$**, e a perda de carga no filtro único de 120 Mesh + válvula solenoide de $3/4\text{"}$ pode limitar a vazão total da zona a **$2,0\text{ a }4,0\text{ L/min}$**!
- **O Efeito nos Horários (E se demorar 2h a 3h por zona para pingar tudo?):**
  - Na `v1.0-Argon`, adicionamos um recuo elástico de madrugada (permitindo voltar o início até `02:30` da manhã se o tempo somado de Zona 1 + Zona 2 for longo) para que ambas terminem antes das `06:40` sem precisar pingar a noite inteira.
  - **O que o Opus pode criar/melhorar:**
    - Um **Auto-Calibrador Hidráulico Inteligente**: Na primeira vez que o ESP32 abrir a Zona 1 com 8 ou 16 mangueiras, o Sensor Hall `SF1` mede nos primeiros 3 minutos a vazão real exata na gravidade (ex: `2,8 L/min`), descobre quantos `L/h por furo` reais estão saindo, salva esse perfil na memória e recalcula automaticamente todas as janelas elásticas!
    - Caso o tempo total do dia fique muito longo em dias de pico de floração + baixa pressão (ex: $> 3\text{ horas}$ por zona), o sistema pode **fracionar inteligentemente em 3 pulsos (Alvorada + Manhã Cedo + Crepúsculo)** ou sugerir ativar o `Relé 6 (Bomba Auxiliar 12V)`.

### Desafio B: Água Quente Parada Dentro da Mangueira Preta de PEBD ($16\text{ mm}$)
- **A Física:** Uma mangueira preta de polietileno de $16\text{ mm}$ guarda cerca de **$0,145\text{ Litros por metro linear}$** (em $80\text{ m}$ de mangueira aberta, ficam parados **$\sim 11,6\text{ Litros}$** de água). Sob o sol de $35^\circ\text{C}$ do Seridó entre 11h00 e 16h00, essa água parada chega a **$48^\circ\text{C}\text{–}52^\circ\text{C}$**.
- **Como a `v1.0-Argon` tratou:** Deslocou o turno da tarde em dias muito quentes ($\ge 34^\circ\text{C}$) para a **Janela Elástica do Crepúsculo (`17:05`)**, quando o sol já baixou e a parede fina da mangueira esfria sozinha no ar antes de abrir a válvula.
- **O que o Opus pode criar/melhorar:**
  - Proteção contra **"Micro-Pulsos Quentes Diurnos"**: Se alguém ou alguma regra tentar ligar a irrigação entre `10h30` e `16h00`, proibir regas curtas ($< 15\text{ min}$) que apenas empurrariam os $12\text{ L}$ de água escaldante para o pé da planta e parariam; ou implementar uma lógica de segurança térmica ainda mais refinada.

### Desafio C: Evolução da Experiência Mobile/Desktop e Diagnóstico Assistido com o Claude
- **O que o Opus pode explorar:**
  - Criar na interface um **"Seletor Visual de Sintomas Rápidos"** antes de clicar em `📤 Compartilhar c/ Claude` (ex: chips clicáveis como *"🍂 Folhas amarelando"*, *"🌸 Flores caindo"*, *"🍉 Fruto rachando"*, *"🐌 Vazão fraca no final da linha"*), anexando o relato humano estruturado junto ao `.yaml`!
  - Explorar visualizações ainda mais ricas no **Command Center Remoto (PC)** para quando o dono estiver longe do sítio.

---

## 🗺️ 4. Mapa Completo da Versão `v1.0-Argon` (O Que Você Pode Copiar ou Adaptar)

| Arquivo em `pro-duo/` | O que ele faz na `v1.0-Argon` | Recomendação para o Opus |
| :--- | :--- | :--- |
| [`DEV_LOG_CHECKPOINT.md`](file:///c:/irriga-ai/pro-duo/DEV_LOG_CHECKPOINT.md) | Diário completo dos Marcos `M0` a `M14` (`v1.0-Argon`). | **Leia primeiro** e use o mesmo formato de checkpoints para não perder progresso! |
| [`planos/plano_irrigacao_sitio.yaml`](file:///c:/irriga-ai/pro-duo/planos/plano_irrigacao_sitio.yaml) | Arquivo padrão `IrrigaPlan v1.0` com instruções de perito embutidas. | **Mantenha a estrutura compatível** (ou estenda sem quebrar as chaves principais). |
| [`engine/irriga_engine.py`](file:///c:/irriga-ai/pro-duo/engine/irriga_engine.py) | Motor Python + Validador de Guardrails + Janela Elástica + Compilador JSON. | Copie a base de validação e experimente evoluir o modelo hidráulico/térmico. |
| [`engine/simulador_safra_benchmark.py`](file:///c:/irriga-ai/pro-duo/engine/simulador_safra_benchmark.py) | Simulador de 260 dias (Jerimum defasado 50d + Rotação Feijão/Batata-doce). | Reutilize para testar se suas novas ideias economizam ainda mais água! |
| [`web-app/index.html`](file:///c:/irriga-ai/pro-duo/web-app/index.html) & [`web-app/app.js`](file:///c:/irriga-ai/pro-duo/web-app/app.js) | App End-User (*Apple Daylight*), PWA Android/iOS, Share Sheet nativo e Command Center PC. | Copie o que já estiver ótimo e dê o seu toque autoral na UX e nas ferramentas de decisão! |
| [`web-app/dev-gui.html`](file:///c:/irriga-ai/pro-duo/web-app/dev-gui.html) | Bancada de engenharia com sliders, presets de benchmark e OLED virtual. | Mantenha separada da interface do usuário final. |
| [`firmware/src/main.cpp`](file:///c:/irriga-ai/pro-duo/firmware/src/main.cpp) | Firmware ESP32 completo (NTP, fila anti-colisão, +1 DAP à meia-noite, 4 travas `SF1`). | Mantenha o pinout e as travas; evolua a auto-calibração de vazão se desejar. |

Divirta-se criando a sua versão, Claude Opus! 🌱💧
