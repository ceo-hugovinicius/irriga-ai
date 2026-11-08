A tarefa:
Estou criando um sistema de irrigação automático para um sítio. O sistema se chama “Irriga.ai”.


O contextualização básica:
O sistema vai rodar pelo ESP32. Deve se conectar com a internet para receber novos horários pra irrigação, mostrar schedule de irrigações futuras e em quais válvulas. Além de mostrar irrigações acontecendo no momento, mostrar nível de caixa de água e indicar se a bomba hidráulica auxiliar está ligada para auxiliar na pressão da irrigação. Usar alguma forma de ler a previsão metereológica e decidir se irriga ou não uma plantação em determinado momento.

Necessidade de uma versão “off-line/off-grid” útil e customizável para onde internet for difícil:
Vai ser necessário que o sistema tenha uma “irrigação padrão” baseada na rotina do usuário (pode ser algum algoritmo que guarde quais irrigações são mais recorrentes num período de 7 dias; ou algo que o usuário configura previamente pela plataforma online; ou simplesmente guardar “ultima_sexta”, “ultima_segunda”, etc. para repetir sete dias depois) A ideia é que exista alguma forma de rodar o sistema off-line, caso não seja possível conectar à rede de internet pra que o sistema ao menos FUNCIONE em um loop previsível.


Interface com botões que sejam úteis para o usuário “in-sito”(caseiro que esteja gerenciando a irrigação das plantas):
Haverão botões num painel para dar “override” nas agendas de automação e fazer ações como 
1- Parar; 
2 - Irrigar todas ao mesmo tempo por uma hora (pode ser incrementado por mais uma hora toda vez que for apertado); 
3 - Função Poupar Água (pra quando, por exemplo, o caseiro precisar que a caixa esteja cheia pela manhã para que ele lave o trator da fazenda); 
4 - Acordar display - 









Você precisa tomar cuidado para nunca configurar o pino como OUTPUT e HIGH : Se você fizer isso no código e encostar o fio no GND, causará um curto-circuito real e queimará o pino ou o ESP32 inteiro. Esse cuidado será necessário quando o usuário estiver fazendo algum sensor personalizado (como uma boia de caixa de água, ou um botão de interface) que use o fechamento de circuito entre Ground e o pino de sinal. 









CÓDIGO MD MARK DOWN DAS PORTAS MÁXIMAS QUE SERÃO USADAS NO SISTEMA.

MAIOR QUANTIDADE DE RELES ( 8 RELES)
UM DISPLAY OLED
QUATRO NÍVEIS DE CAIXA DE ÁGUA
QUATRO BOTÕES 


# Manual de Referência: Automação Residencial com ESP32

Este documento serve como guia oficial de hardware, mapeamento de pinos e regras de implementação para o sistema de automação. O circuito foi projetado para operar de forma direta (sem expansores de portas), garantindo isolamento elétrico total contra interferências magnéticas (EMI) e estabilidade na inicialização (boot).

---

## 📋 Resumo do Setup Dedicado
* **Microcontrolador:** ESP32 (DevKit 30 ou 38 pinos)
* **Saídas:** 12 Relés (distribuídos em 2 placas físicas de 8 canais) + 4 canais de sobra
* **Entradas:** 4 Botões personalizados + 4 Níveis para leitura da caixa d'água
* **Visualização:** 1 Display OLED de 0.96" via barramento I2C

---

## 🗺️ Mapeamento Oficial de Pinos (Pinout)

### 1. Comunicação e Visualização (I2C)

| Componente | Pino ESP32 | Função | Tipo | Notas Técnicas |
| :--- | :---: | :---: | :---: | :--- |
| **Display OLED** | **GPIO 21** | SDA | Dados | Linha de comunicação I2C padrão. |
| **Display OLED** | **GPIO 22** | SCL | Clock | Linha de comunicação I2C padrão. |

### 2. Botões Personalizados (Entradas Digitais)
*Ligue cada botão diretamente entre o pino do ESP32 e o **GND** comum.*
*No código, configure obrigatoriamente como `INPUT_PULLUP` para ativar os resistores internos.*

| Componente | Pino ESP32 | Modo no Código | Referência Elétrica |
| :--- | :---: | :--- | :--- |
| **Botão 01** | **GPIO 13** | `INPUT_PULLUP` | Retorna `LOW` quando pressionado. |
| **Botão 02** | **GPIO 14** | `INPUT_PULLUP` | Retorna `LOW` quando pressionado. |
| **Botão 03** | **GPIO 26** | `INPUT_PULLUP` | Retorna `LOW` quando pressionado. |
| **Botão 04** | **GPIO 27** | `INPUT_PULLUP` | Retorna `LOW` quando pressionado. |

### 3. Sensor de Nível da Caixa d'Água (Contatos Condutivos)
*O pino comum posicionado no fundo da caixa d'água deve ser ligado ao **GND** do ESP32.*
*Quando a água atinge o nível da haste, fecha o circuito enviando o sinal de terra (`LOW`) para o pino correspondente.*

| Nível d'Água | Pino ESP32 | Configuração de Pull-up | Requisito de Hardware |
| :--- | :---: | :--- | :--- |
| **Nível 1 (25%)** | **GPIO 32** | `INPUT_PULLUP` (Interno) | Ligação direta (fio do nível ao pino). |
| **Nível 2 (50%)** | **GPIO 33** | `INPUT_PULLUP` (Interno) | Ligação direta (fio do nível ao pino). |
| **Nível 3 (75%)** | **GPIO 34** | `INPUT` (Apenas entrada) | **Obrigatório:** Resistor físico de 10kΩ externo ligado entre o pino e o 3.3V. |
| **Nível 4 (100%)** | **GPIO 35** | `INPUT` (Apenas entrada) | **Obrigatório:** Resistor físico de 10kΩ externo ligado entre o pino e o 3.3V. |

### 4. Atuadores (12 Comandos de Relé)
*Os pinos devem ser configurados como `OUTPUT`. Por segurança de inicialização, os pinos de 08 a 12 utilizam pinos de Boot (`Strapping Pins`) e exigem módulos de relé que acionam em Nível Baixo (`Active Low`).*

#### Placa de Relés nº 1 (Canais de 1 a 8)
* **Relé 01:** GPIO 4
* **Relé 02:** GPIO 16
* **Relé 03:** GPIO 17
* **Relé 04:** GPIO 18
* **Relé 05:** GPIO 19
* **Relé 06:** GPIO 23
* **Relé 07:** GPIO 25
* **Relé 08:** GPIO 15 *(Atenção: Pino de Boot)*

#### Placa de Relés nº 2 (Canais de 9 a 12)
* **Relé 09:** GPIO 0 *(Atenção: Pino de Boot — Essencial que o relé seja Active Low)*
* **Relé 10:** GPIO 2 *(Atenção: Pino de Boot e LED interno da placa)*
* **Relé 11:** GPIO 5 *(Atenção: Pino de Boot)*
* **Relé 12:** GPIO 12 *(Atenção: Pino de Boot — Se mantido em nível lógico Alto no boot, impede a inicialização)*
* *Canais 13, 14, 15 e 16 desta placa permanecem livres para expansões futuras.*

---

## ⚠️ Regras de Ouro para a Instalação Física (Hardware Seguro)

1. **Separação Elétrica Total (Isolamento Óptico):**
   * Remova completamente a capa plástica (jumper) que interliga os pinos **JD-VCC** e **VCC** de ambas as placas de relé.
   * Conecte o polo Positivo (+5V) da **Fonte Externa de 5V 3A** exclusivamente no pino **JD-VCC** das placas de relé.
   * Conecte o polo Negativo (GND) da **Fonte Externa** no pino **GND** ao lado do JD-VCC.
   * Conecte o pino **VCC** da barra de sinal principal do módulo relé ao pino **3.3V do ESP32**. 
   * *Resultado:* O circuito lógico do ESP32 acende apenas o LED interno do optoacoplador. Toda a energia bruta para armar as bobinas dos relés vem da fonte externa de 5V, bloqueando ruídos elétricos direcionados ao microcontrolador.

2. **Mitigação de Interferência Magnética (EMI):**
   * Não agrupe os fios de sinal (que vão para os sensores da caixa d'água e botões) junto com as fiações de corrente alternada (110V/220V) que saem dos contatos dos relés.
   * Posicione as duas placas de 8 relés afastadas a pelo menos **10 a 15 cm de distância física** do ESP32 e do Display OLED.

3. **Inibição de Estática no OLED:**
   * O display OLED é extremamente sensível a transientes gerados pelo chaveamento de cargas indutivas (motores, bombas d'água, reatores). O isolamento via JD-VCC com fonte externa é a blindagem principal para que a tela não apresente riscos ou trave durante os acionamentos.

---

## 🛠️ Lista de Materiais Homologada
1. **1x Módulo ESP32** (DevKit v1 NodeMCU – de preferência com 38 pinos).
2. **2x Placas de Módulo Relé 8 Canais 5V** com Isolamento por Optoacoplador e Jumper JD-VCC.
3. **1x Display OLED de 0.96" I2C** (Controlador SSD1306).
4. **1x Fonte Chaveada Estabilizada 5V (2A ou 3A)** para alimentação dedicada das bobinas dos relés.
5. **1x Fonte 5V USB** estável e independente para alimentar o ESP32.
6. **4x Chaves Táteis / Push-buttons** para os botões de controle local.
7. **2x Resistores de 10kΩ** (Tolerância de 5% ou 1%) para o circuito das entradas GPIO 34 e 35.







$:$:$;$:!:).$:!$:$:


Shjdhsjshsbshshsh





# Manual de Referência Otimizado: Automação Residencial com ESP32 (8 Relés)

Este documento substitui a versão anterior e serve como o guia oficial de hardware do sistema. Ao reduzir a quantidade para **8 relés**, o circuito foi otimizado para eliminar completamente o uso de pinos de boot complexos para acionamento e dispensar o uso de componentes externos nos sensores, tornando a montagem mais segura, limpa e imune a interferências magnéticas (EMI).

---

## 📋 Resumo do Setup Otimizado
* **Microcontrolador:** ESP32 (DevKit 30 ou 38 pinos)
* **Saídas:** 1 Placa de Módulo Relé (8 canais) + 1 Buzzer (Alarme Sonoro)
* **Entradas:** 4 Botões personalizados + 4 Níveis para leitura da caixa d'água (**100% via Pull-up Interno**)
* **Visualização:** 1 Display OLED de 0.96" via barramento I2C

---

## 🗺️ Mapeamento Oficial de Pinos (Pinout)

### 1. Comunicação e Visualização (I2C)

| Componente | Pino ESP32 | Função | Tipo | Notas Técnicas |
| :--- | :---: | :---: | :---: | :--- |
| **Display OLED** | **GPIO 21** | SDA | Dados | Linha de comunicação I2C padrão. |
| **Display OLED** | **GPIO 22** | SCL | Clock | Linha de comunicação I2C padrão. |

### 2. Botões Personalizados (Entradas Digitais)
*Ligue cada botão diretamente entre o pino do ESP32 e o **GND** comum.*
*No código, configure obrigatoriamente como `INPUT_PULLUP`.*

| Componente | Pino ESP32 | Modo no Código | Referência Elétrica |
| :--- | :---: | :--- | :--- |
| **Botão 01** | **GPIO 13** | `INPUT_PULLUP` | Retorna `LOW` quando pressionado. |
| **Botão 02** | **GPIO 14** | `INPUT_PULLUP` | Retorna `LOW` quando pressionado. |
| **Botão 03** | **GPIO 26** | `INPUT_PULLUP` | Retorna `LOW` quando pressionado. |
| **Botão 04** | **GPIO 27** | `INPUT_PULLUP` | Retorna `LOW` quando pressionado. |

### 3. Sensor de Nível da Caixa d'Água (Contatos Condutivos — Sem Resistor)
*O pino comum no fundo da caixa d'água deve ser ligado ao **GND** do ESP32.*
*Com a mudança de pinos, **não é necessário nenhum resistor externo**. Todos utilizam o pull-up interno.*

| Nível d'Água | Pino ESP32 | Configuração de Pull-up | Requisito de Hardware |
| :--- | :---: | :--- | :--- |
| **Nível 1 (25%)** | **GPIO 32** | `INPUT_PULLUP` (Interno) | Ligação direta (fio do nível ao pino). |
| **Nível 2 (50%)** | **GPIO 33** | `INPUT_PULLUP` (Interno) | Ligação direta (fio do nível ao pino). |
| **Nível 3 (75%)** | **GPIO 12** | `INPUT_PULLUP` (Interno) | Ligação direta (fio do nível ao pino). |
| **Nível 4 (100%)** | **GPIO 15** | `INPUT_PULLUP` (Interno) | Ligação direta (fio do nível ao pino). |

### 4. Atuadores e Sinalização (Saídas)
*Os pinos abaixo devem ser configurados como `OUTPUT`. Com o remanejamento, os pinos mais críticos de boot foram totalmente liberados, trazendo estabilidade nativa no momento em que a placa é ligada.*

| Componente | Pino ESP32 | Comportamento no Código | Notas de Hardware |
| :--- | :---: | :--- | :--- |
| **Relé 01** | **GPIO 4** | `OUTPUT` | Pino de uso geral 100% seguro. |
| **Relé 02** | **GPIO 16** | `OUTPUT` | Pino de uso geral 100% seguro. |
| **Relé 03** | **GPIO 17** | `OUTPUT` | Pino de uso geral 100% seguro. |
| **Relé 04** | **GPIO 18** | `OUTPUT` | Pino de uso geral 100% seguro. |
| **Relé 05** | **GPIO 19** | `OUTPUT` | Pino de uso geral 100% seguro. |
| **Relé 06** | **GPIO 23** | `OUTPUT` | Pino de uso geral 100% seguro. |
| **Relé 07** | **GPIO 25** | `OUTPUT` | Pino de uso geral 100% seguro. |
| **Relé 08** | **GPIO 5** | `OUTPUT` | Pino seguro para saída digital. |
| **Buzzer Ativo** | **GPIO 2** | `OUTPUT` | Emite alertas sonoros (caixa cheia/vazia). |

*Nota: Os pinos **GPIO 0, 34, 35, 36 e 39** ficaram totalmente livres para futuras expansões.*

---

## ⚠️ Regras de Ouro para a Instalação Física (Hardware Seguro)

1. **Isolamento Óptico Total (Conexão JD-VCC):**
   * Remova o jumper plástico que une os pinos **JD-VCC** e **VCC** do módulo de 8 relés.
   * Conecte o polo Positivo (+5V) de uma **Fonte Externa de 5V (mínimo 1A ou 2A)** diretamente no pino **JD-VCC**.
   * Conecte o polo Negativo (GND) dessa mesma fonte externa no pino **GND** ao lado do JD-VCC.
   * Conecte o pino **VCC** (da barra de sinal dos pinos `IN`) ao pino **3.3V do ESP32**.
   * *Importante:* O **GND do ESP32 NÃO deve ser unido** ao GND da fonte dos relés se você quiser isolamento óptico completo. Deixe que os chips pretos (optoacopladores) façam a ponte apenas por luz.

2. **Blindagem contra Ruídos e Estática (OLED e Buzzer):**
   * O isolamento elétrico acima evita que o display OLED trave ou exiba caracteres corrompidos quando as bobinas dos relés ligarem ou desligarem.
   * Mantenha a placa de 8 relés a pelo menos **10 a 15 cm de distância** do ESP32, do Display OLED e dos fios dos sensores da caixa d'água.

3. **Ligação do Buzzer:**
   * Utilize um **Buzzer Ativo de 3.3V ou 5V** (módulos de buzzer facilitam a ligação). O polo positivo vai conectado ao **GPIO 2** e o negativo ao **GND** do ESP32.

---

## 🛠️ Lista de Materiais Atualizada
1. **1x Módulo ESP32** (DevKit v1 NodeMCU – 30 ou 38 pinos).
2. **1x Módulo Relé 8 Canais 5V** com Isolamento por Optoacoplador e Jumper JD-VCC.
3. **1x Display OLED de 0.96" I2C** (Controlador SSD1306).
4. **1x Módulo Buzzer Ativo** (compatível com sinal lógico de 3.3V).
5. **1x Fonte Chaveada Estabilizada 5V (1A ou 2A)** para alimentação exclusiva do JD-VCC do relé.
6. **1x Fonte ou Cabo USB de boa qualidade** para alimentar o ESP32 de forma independente.
7. **4x Chaves Táteis / Push-buttons** para os botões de controle local.





Jdhdhshshdhshhshdhshsbxjxbdbxxbxbdbsjnsbsdbdbsbsnsbzbsnszbzbsbsbsbshshshsbsbsbzbzhsbsbsbsbsbsbsbsb






O sistema deve ter uma rotina que teste o nível de vazão de água após a passagem pelos filtros e pela bomba. Pode ter uma saída próxima pra que a perda de carga pelo sistema não altere a informação. Aí o valor adquirido seria testado contra um Benchmark armazenado na memória e se fosse visto uma perda de vazão, o sistema lançaria um aviso que algo estava errado.
