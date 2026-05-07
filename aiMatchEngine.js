const db = require('./db');

const ANTHROPIC_API   = 'https://api.anthropic.com/v1/messages';
const MATCH_THRESHOLD = 50;

async function runMatchingForItem(newItem) {
  try {
    const oppositeType = newItem.type === 'lost' ? 'found' : 'lost';

    // Works with original schema — plain category VARCHAR
    const [candidates] = await db.execute(
      `SELECT * FROM items WHERE type = ? AND status = 'active' AND item_id != ?`,
      [oppositeType, newItem.item_id]
    );

    if (!candidates.length) return;

    for (const candidate of candidates) {
      const score = await computeMatchScore(newItem, candidate);
      console.log(`Comparing "${newItem.title}" vs "${candidate.title}" → ${score}%`);
      if (score >= MATCH_THRESHOLD) {
        await saveMatch(newItem, candidate, score);
      }
    }
  } catch (err) {
    console.error('AI Match Engine Error:', err.message);
  }
}

async function computeMatchScore(itemA, itemB) {
  const textScore = computeTextScore(itemA, itemB);   // 0-50
  const catScore  = computeCategoryScore(itemA, itemB); // 0-20
  const locScore  = computeLocationScore(itemA, itemB); // 0-10
  const localScore = textScore + catScore + locScore;

  let aiScore = 0;
  if (localScore >= 15 && process.env.ANTHROPIC_API_KEY &&
      process.env.ANTHROPIC_API_KEY !== 'your_anthropic_api_key_here') {
    aiScore = await getClaudeScore(itemA, itemB);     // 0-20
  }

  return Math.min(100, Math.round(localScore + aiScore));
}

function computeTextScore(a, b) {
  const tokenise = (item) => {
    const raw = `${item.title || ''} ${item.description || ''}`.toLowerCase();
    return new Set(raw.replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w)));
  };
  const setA = tokenise(a), setB = tokenise(b);
  if (!setA.size || !setB.size) return 0;
  const intersection = [...setA].filter(w => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return Math.round((intersection / union) * 50);
}

function computeCategoryScore(a, b) {
  const catA = (a.category || '').toLowerCase().trim();
  const catB = (b.category || '').toLowerCase().trim();
  if (!catA || !catB) return 0;
  return catA === catB ? 20 : 0;
}

function computeLocationScore(a, b) {
  const wordsA = new Set((a.location || '').toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set((b.location || '').toLowerCase().split(/\s+/).filter(w => w.length > 2));
  return [...wordsA].filter(w => wordsB.has(w)).length > 0 ? 10 : 0;
}

async function getClaudeScore(lostItem, foundItem) {
  const lost  = lostItem.type  === 'lost'  ? lostItem  : foundItem;
  const found = foundItem.type === 'found' ? foundItem : lostItem;
  const prompt = `You are a lost-and-found matcher.
LOST:  Title: ${lost.title} | Desc: ${lost.description || 'N/A'} | Category: ${lost.category || 'N/A'} | Location: ${lost.location || 'N/A'}
FOUND: Title: ${found.title} | Desc: ${found.description || 'N/A'} | Category: ${found.category || 'N/A'} | Location: ${found.location || 'N/A'}
Rate 0-20: how likely are these the SAME physical object? Reply with ONE integer only.`;

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version':'2023-06-01' },
      body: JSON.stringify({ model:'claude-haiku-4-5-20251001', max_tokens:10, messages:[{ role:'user', content:prompt }] })
    });
    const data = await res.json();
    const num = parseInt(data?.content?.[0]?.text?.trim(), 10);
    return isNaN(num) ? 0 : Math.min(20, Math.max(0, num));
  } catch (err) {
    console.warn('Claude API skipped:', err.message);
    return 0;
  }
}

async function saveMatch(itemA, itemB, score) {
  const lostItem  = itemA.type === 'lost'  ? itemA : itemB;
  const foundItem = itemA.type === 'found' ? itemA : itemB;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute(
      `INSERT INTO ai_matches (lost_item_id, found_item_id, confidence_score, match_reason, status)
       VALUES (?, ?, ?, ?, 'pending')
       ON DUPLICATE KEY UPDATE confidence_score=VALUES(confidence_score), match_reason=VALUES(match_reason), updated_at=NOW()`,
      [lostItem.item_id, foundItem.item_id, score, buildMatchReason(lostItem, foundItem, score)]
    );

    await conn.execute(
      `UPDATE items SET status = 'matched' WHERE item_id IN (?, ?)`,
      [lostItem.item_id, foundItem.item_id]
    );

    // Notify lost item owner
    if (lostItem.user_id) {
      await conn.execute(
        `INSERT INTO notifications (user_id, message) VALUES (?, ?)`,
        [lostItem.user_id, `🤖 AI found a ${score}% match for your lost item "${lostItem.title}"! Check AI Matches.`]
      );
    }
    // Notify found item owner
    if (foundItem.user_id) {
      await conn.execute(
        `INSERT INTO notifications (user_id, message) VALUES (?, ?)`,
        [foundItem.user_id, `🤖 The item you found "${foundItem.title}" matches a lost report at ${score}% confidence!`]
      );
    }

    await conn.commit();
    console.log(`✅ AI Match saved: item ${lostItem.item_id} ↔ ${foundItem.item_id} (${score}%)`);
  } catch (err) {
    await conn.rollback();
    console.error('saveMatch failed:', err.message);
  } finally {
    conn.release();
  }
}

function buildMatchReason(lost, found, score) {
  const reasons = [];
  const catA = (lost.category  || '').toLowerCase();
  const catB = (found.category || '').toLowerCase();
  if (catA && catA === catB) reasons.push(`same category (${lost.category})`);
  const locA = (lost.location  || '').toLowerCase();
  const locB = (found.location || '').toLowerCase();
  if (locA.split(/\s+/).some(w => w.length > 2 && locB.includes(w))) reasons.push('overlapping location');
  const shared = (lost.title || '').toLowerCase().split(/\s+/)
    .filter(w => w.length > 2 && (found.title || '').toLowerCase().includes(w));
  if (shared.length) reasons.push(`matching keywords: ${shared.slice(0,3).join(', ')}`);
  if (!reasons.length) reasons.push('text similarity');
  return reasons.join(' · ');
}

const STOP_WORDS = new Set([
  'the','and','for','that','this','with','have','from','are','was','were',
  'been','has','had','not','but','they','its','our','your','their','there',
  'here','when','what','which','who','will','would','could','should','may',
  'can','item','lost','found','near','area','campus','university'
]);

module.exports = { runMatchingForItem };