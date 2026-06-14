-- Seed: 9 dias da Novena a Nossa Senhora do Bom Remédio
-- Novena: f3dbe7b2-1298-4938-b504-49709f659f69 (estava publicada sem dias → dead-end).
-- Temas fiéis à devoção autêntica: São João de Mata / Ordem Trinitária (1198),
-- Maria "Remédio" para o resgate de cativos e para todas as necessidades de
-- corpo e alma. Estilo conciso, alinhado com as restantes novenas da app.
-- A novena fica published=false até revisão. Para publicar:
--   update public.novenas set published = true where id = 'f3dbe7b2-1298-4938-b504-49709f659f69';

begin;

delete from public.novena_days
where novena_id = 'f3dbe7b2-1298-4938-b504-49709f659f69';

insert into public.novena_days (novena_id, day_number, theme, content) values
('f3dbe7b2-1298-4938-b504-49709f659f69', 1, 'Maria, Remédio para todas as aflições',
 'Nossa Senhora do Bom Remédio, em vós encontramos auxílio para todas as necessidades da alma e do corpo. Ensinai-nos a recorrer a vós com confiança em cada aflição, certos de que nunca abandonais quem a vós se entrega.'),
('f3dbe7b2-1298-4938-b504-49709f659f69', 2, 'Mãe que liberta os cativos',
 'Mãe do Bom Remédio, sob cuja proteção São João de Mata resgatou tantos cativos, alcançai a libertação de todos os que vivem oprimidos. Quebrai as correntes que aprisionam o coração e dai-nos a verdadeira liberdade dos filhos de Deus.'),
('f3dbe7b2-1298-4938-b504-49709f659f69', 3, 'Remédio para as enfermidades do corpo',
 'Nossa Senhora do Bom Remédio, saúde dos enfermos, intercedei junto de vosso Filho pela cura dos que sofrem no corpo. Que a vossa ternura materna seja bálsamo nas nossas dores e força na provação da doença.'),
('f3dbe7b2-1298-4938-b504-49709f659f69', 4, 'Remédio para as feridas da alma',
 'Mãe do Bom Remédio, refúgio dos pecadores, alcançai-nos o perdão e a cura das feridas do pecado. Conduzi-nos ao sacramento da Reconciliação e ajudai-nos a recomeçar sempre no amor de Deus.'),
('f3dbe7b2-1298-4938-b504-49709f659f69', 5, 'Libertação dos vícios e dependências',
 'Nossa Senhora do Bom Remédio, vós que libertais das mais duras escravidões, livrai-nos de todo o vício e dependência que nos afastam de Deus. Dai-nos a graça da temperança e a vitória sobre tudo o que nos aprisiona.'),
('f3dbe7b2-1298-4938-b504-49709f659f69', 6, 'Confiança na divina Providência',
 'Mãe do Bom Remédio, vós que socorrestes os fundadores na hora da necessidade, ensinai-nos a confiar na Providência do Pai. Que nunca falte a esperança nas dificuldades, sabendo que tudo podemos com a vossa intercessão.'),
('f3dbe7b2-1298-4938-b504-49709f659f69', 7, 'Remédio nas aflições da família',
 'Nossa Senhora do Bom Remédio, guardiã dos lares cristãos, levai a vossa paz às nossas famílias. Curai as divisões, reconciliai os corações afastados e protegei os nossos sob o vosso manto.'),
('f3dbe7b2-1298-4938-b504-49709f659f69', 8, 'Perseverança na fé e na vida cristã',
 'Mãe do Bom Remédio, sustentai-nos na fidelidade ao Evangelho. Ajudai-nos a perseverar na oração, nos sacramentos e na caridade, para que nunca nos falte o remédio da graça até ao fim da vida.'),
('f3dbe7b2-1298-4938-b504-49709f659f69', 9, 'Gratidão e poderosa intercessão',
 'Nossa Senhora do Bom Remédio, com o coração cheio de gratidão, confiamos-vos as nossas intenções. Apresentai-as a vosso Filho Jesus e alcançai-nos o bem que pedimos, se for para glória de Deus e salvação das nossas almas. Amém.');

commit;
