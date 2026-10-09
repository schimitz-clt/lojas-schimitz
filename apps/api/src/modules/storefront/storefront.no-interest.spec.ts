/**
 * Texto salvo no banco (configurações da loja) nunca sai prometendo "sem juros": em produção a
 * descrição do site tinha "3x sem juros" gravada pelo admin, e o MP cobra juros em 2x/3x.
 */
import assert from 'assert';
import { serializeSettings, StorefrontService } from './storefront.service';
import { NO_INTEREST_CLAIM_RE, SAFE_SITE_DESCRIPTION, promisesNoInterest } from '../../common/no-interest-claim';

const base = { id: 'default', siteTitle: 'Lojas Schimitz', ogImageUrl: null, updatedAt: new Date() };

for (const t of ['3x sem juros', 'Até 3x s/ juros', 'sem acréscimo', 'juros zero', '0% de juros', 'SEM  JUROS']) {
  assert.equal(promisesNoInterest(t), true, t);
}
for (const t of ['Parcele em até 12x no cartão', 'juros conforme o cartão', 'Os juros, se houver, aparecem antes de pagar', '', null, undefined]) {
  assert.equal(promisesNoInterest(t), false, String(t));
}
assert.ok(!NO_INTEREST_CLAIM_RE.test(SAFE_SITE_DESCRIPTION), 'descrição segura não promete sem juros');
assert.ok(SAFE_SITE_DESCRIPTION.includes('PIX 5%') && SAFE_SITE_DESCRIPTION.includes('12x'));

// Descrição antiga do banco é trocada na saída pública.
const old = serializeSettings({
  ...base,
  siteDescription: 'Lojas Schimitz — frete grátis em Porto Alegre, PIX 5% off e 3x sem juros',
});
assert.equal(old.siteDescription, SAFE_SITE_DESCRIPTION);

// Descrição boa passa intacta.
const ok = serializeSettings({ ...base, siteDescription: 'Eletro, celulares e casa em Porto Alegre.' });
assert.equal(ok.siteDescription, 'Eletro, celulares e casa em Porto Alegre.');

// Faixas e selos com a promessa são removidos; os demais ficam; lista vazia vira null.
const mixed = serializeSettings({
  ...base,
  siteDescription: 'Eletro, celulares e casa em Porto Alegre.',
  promoLines: ['Frete grátis em POA', 'Até 3x sem juros', '5% OFF no PIX'],
  trustItems: [
    { title: 'Parcelamento', body: '3x sem juros' },
    { title: 'Troca', body: 'Em 7 dias' },
  ],
});
assert.deepEqual(mixed.promoLines, ['Frete grátis em POA', '5% OFF no PIX']);
assert.deepEqual(mixed.trustItems, [{ title: 'Troca', body: 'Em 7 dias' }]);
const only = serializeSettings({
  ...base,
  siteDescription: 'Eletro, celulares e casa em Porto Alegre.',
  promoLines: ['Até 3x sem juros'],
  trustItems: [{ title: 'Parcelamento', body: '3x s/ juros' }],
});
assert.equal(only.promoLines, null);
assert.equal(only.trustItems, null);

// Admin não consegue salvar a promessa de novo.
(async () => {
  const svc = new StorefrontService({} as never);
  for (const input of [
    { siteTitle: 'Lojas Schimitz', siteDescription: 'PIX 5% off e 3x sem juros no cartão' },
    { siteTitle: 'Lojas Schimitz', siteDescription: 'Eletro e casa em Porto Alegre', promoLines: ['Até 3x sem juros'] },
  ]) {
    await assert.rejects(() => svc.updateSettings(input), /sem juros/i);
  }
  console.log('storefront.no-interest.spec ok');
})();
