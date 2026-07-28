# Planejamento: áreas e setores para distribuição física

## Objetivo

Detalhar os destinos da distribuição de cópias físicas de documentos controlados.
Hoje o destino é selecionado de forma ampla por área. A evolução proposta permite
registrar também o setor específico que receberá a cópia.

Exemplo:

- Área: `PRO — Produção`
- Setor: `Encapsulamento 1`

## Proposta funcional

1. Adicionar em **Administração → Catálogos** um catálogo de **Áreas e Setores**.
2. Cada área terá código, nome e situação (ativo/inativo).
3. Cada setor será obrigatoriamente vinculado a uma área e terá nome e situação
   (ativo/inativo).
4. No formulário de distribuição de cópias físicas, o usuário selecionará primeiro
   a área e, em seguida, um ou mais setores pertencentes a ela.
5. Manter a opção **Área inteira** para os casos em que a cópia deve ser distribuída
   a todos os setores da área.

## Exemplos iniciais

| Área | Setor |
| --- | --- |
| PRO — Produção | Encapsulamento 1 |
| PRO — Produção | Encapsulamento 2 |
| PRO — Produção | Compressão |
| CQ — Controle de Qualidade | Físico-químico |
| CQ — Controle de Qualidade | Microbiologia |

## Rastreabilidade e compatibilidade

- O histórico deverá registrar o destino completo, por exemplo:
  `PRO — Produção / Encapsulamento 1`.
- Cópias distribuídas para uma área inteira devem continuar identificadas apenas
  pela área.
- Áreas e setores inativos não poderão ser escolhidos em novas distribuições, mas
  devem continuar visíveis nos registros históricos.
- As distribuições existentes não devem ser alteradas nem exigir migração manual.

## Escopo para a próxima etapa

Definir os cadastros iniciais de áreas e seus setores, revisar o fluxo atual de
distribuição e então implementar a modelagem, catálogo administrativo, interface de
seleção dependente e os ajustes de histórico/recolha por revisão.
