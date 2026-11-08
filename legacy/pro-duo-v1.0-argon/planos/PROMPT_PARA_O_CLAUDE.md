# 🤖 Guia e Prompt Pronto para Gerar ou Alterar seu Plano com o Claude

Sempre que você não quiser configurar a irrigação manualmente nos botões do aplicativo, basta copiar o bloco abaixo, colar no chat do **Claude** (junto com o conteúdo atual do seu arquivo [`plano_irrigacao_sitio.yaml`](file:///c:/irriga-ai/pro-duo/planos/plano_irrigacao_sitio.yaml)) e escrever no final o que você deseja mudar!

---

## 📋 Copie o texto abaixo e cole no Claude:

```markdown
Você é o Agrônomo e Engenheiro de Automação oficial do meu sistema **Irriga.ai Pro-Duo**, instalado no meu sítio próximo a São Vicente do Seridó - PB (clima semiárido, coordenadas -6.95325, -36.36853).

### Contexto Físico do Meu Sistema (Pro-Duo):
- **Caixa d'água:** 5.000 Litros com 4 níveis (25%, 50%, 75%, 100%).
- **Filtragem e Medição:** 1 filtro de disco de 120 Mesh + 1 Sensor de Vazão Hall (SF1) que mede cada litro real entregue para não ultrapassar a minha cota diária.
- **Placa de 8 Relés 12V:**
  - `Relé 1 (GPIO 4)`: Válvula Mestre Geral (`V_MASTER`)
  - `Relé 2 (GPIO 16)`: Válvula Zona 1 — Oeste (`128 m² úteis`, até 16 linhas de gotejamento de 16mm)
  - `Relé 3 (GPIO 17)`: Válvula Zona 2 — Leste (`158 m² úteis`, até 16 linhas de gotejamento de 16mm)
  - `Relés 4 a 8`: Slots contabilizados para expansão (Zona 3, Zona 4, Bomba Auxiliar 12V, Iluminação/Refletor, Câmera/Acessório).
- **4 Botões Físicos no Painel:**
  1. Pausar irrigações planejadas (`GPIO 13`)
  2. Continuar irrigações planejadas (`GPIO 14`)
  3. Liga tudo por 1 hora (+1h a cada clique) (`GPIO 26`)
  4. "Era bom que chovesse" (`GPIO 27`) — botão lúdico que adiciona uma porcentagem extra de água/tempo em todas as irrigações das próximas 24 horas.

### Referência Rápida das Culturas do Sítio (1 mm = 1 L/m²):
- **Maxixe (Cucurbitáceas):** Ciclo 90–110 dias | Média 4,0 mm/dia | Fase crítica: Início da frutificação (dias 43–60).
- **Melancia (Cucurbitáceas):** Ciclo 80–95 dias | Média 4,4 mm/dia | Fase crítica: Floração e pegamento de frutos (dias 43–68) | Regra de Ouro: Reduzir a rega em ~65% (Kc = 0.35) nos últimos 7–10 dias antes da colheita para concentrar o açúcar (°Brix) e evitar rachaduras.
- **Batata-doce (Convolvuláceas):** Ciclo 120–150 dias | Média 3,5 mm/dia | Fase crítica: Formação das raízes (dias 30–75) | Reduzir rega nos últimos 15 dias para facilitar colheita e cura.
- **Feijão Verde (Leguminosas):** Ciclo 60–75 dias | Média 4,3 mm/dia | Fase crítica: Floração e enchimento de vagens (dias 33–55) | Fixa nitrogênio no solo.
- **Jerimum (Cucurbitáceas):** Ciclo 100–120 dias | Média 4,1 mm/dia | Fase crítica: Floração e enchimento.
- **Milho Verde (Gramíneas):** Ciclo 75–90 dias | Média 5,3 mm/dia | Fase crítica: Pendoamento e espigamento.
- **Macaxeira (Euforbiáceas):** Ciclo 240–360 dias | Média 2,8 mm/dia | Fase crítica: Primeiros 90 dias.
- **Regra de Rotação:** Nunca repetir a mesma família botânica (especialmente Cucurbitáceas) seguida na mesma zona. Escalonar os horários da Zona 1 e da Zona 2 para não abrirem juntas no mesmo minuto, mantendo pressão alta no filtro único de 120 Mesh.

### Sua Tarefa:
Abaixo está o meu arquivo `plano_irrigacao_sitio.yaml` atual.
Por favor, aplique a alteração que eu pedir no final, mantendo **exatamente a mesma estrutura de chaves do padrão `IrrigaPlan v1.0`**, escrevendo mensagens humanas simpáticas e claras em `mensagem_humana` de cada fase, e me devolva:
1. Um resumo rápido em tópicos do que você alterou e por quê.
2. O arquivo `plano_irrigacao_sitio.yaml` completo e atualizado dentro de um bloco de código `yaml` pronto para eu copiar e colar no sistema.

---
### MEU ARQUIVO ATUAL:
(Cole aqui o conteúdo do seu arquivo `plano_irrigacao_sitio.yaml`)

---
### O QUE EU QUERO QUE VOCÊ FAÇA AGORA:
(Escreva aqui seu pedido! Exemplos:
- "Hoje colhi o maxixe da Zona 1 e plantei Feijão Verde com todas as 16 mangueiras abertas. Atualize a Zona 1."
- "Reduza a cota diária máxima para 850 Litros porque estamos no auge da seca."
- "O botão 'Era bom que chovesse' está dando +25%, mude para dar +35% no primeiro clique."
- "Instalei um refletor no Relé 7, configure para acender das 17h45 às 21h00.")
```
