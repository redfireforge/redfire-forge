//! Curated Faker-style helpers — port of `src/shared/api-mock/templateFaker.ts`.

const FIRST: &[&str] = &["Ada", "Grace", "Linus", "Niels", "Alan", "Barbara", "Ken", "Dorothy"];
const LAST: &[&str] = &[
    "Lovelace", "Hopper", "Torvalds", "Bohr", "Turing", "Liskov", "Thompson", "Vaughan",
];
const CITIES: &[&str] = &["Austin", "Boston", "Seattle", "Lisbon", "Kyoto", "Oslo", "Nairobi", "Recife"];
const WORDS: &[&str] = &["alpha", "bravo", "cipher", "delta", "echo", "falcon", "gamma", "harbor"];
const PRODUCTS: &[&str] = &["widget", "gasket", "relay", "sensor", "module", "adapter", "fixture", "probe"];

pub fn render_faker_helper(path: &str, draw: i64) -> String {
    let key = path.trim().strip_prefix("faker.").unwrap_or(path.trim());
    let first = pick(FIRST, draw);
    let last = pick(LAST, draw + 3);
    match key {
        "person.firstName" => first.into(),
        "person.lastName" => last.into(),
        "person.fullName" => format!("{first} {last}"),
        "internet.userName" => format!("{}.{}", first.to_ascii_lowercase(), last.to_ascii_lowercase()),
        "internet.email" => format!("{}.{}@example.test", first.to_ascii_lowercase(), last.to_ascii_lowercase()),
        "location.city" => pick(CITIES, draw).into(),
        "lorem.word" => pick(WORDS, draw).into(),
        "lorem.sentence" => format!("The {} {} holds.", pick(WORDS, draw), pick(PRODUCTS, draw + 1)),
        "string.alphanumeric" => digits_from(draw, 8, b"abcdefghijklmnopqrstuvwxyz0123456789"),
        "string.uuid" => {
            let h = digits_from(draw, 32, b"0123456789abcdef");
            format!(
                "{}-{}-4{}-a{}-{}",
                &h[0..8],
                &h[8..12],
                &h[13..16],
                &h[17..20],
                &h[20..32]
            )
        }
        "number.int" => (draw.unsigned_abs() % 10_000).to_string(),
        "datatype.boolean" => ((draw & 1) == 0).to_string(),
        "commerce.product" => pick(PRODUCTS, draw).into(),
        "phone.number" => format!("+1-555-01{:02}", draw.unsigned_abs() % 100),
        _ => String::new(),
    }
}

fn pick<'a>(items: &'a [&str], n: i64) -> &'a str {
    items[n.unsigned_abs() as usize % items.len()]
}

fn digits_from(n: i64, len: usize, alphabet: &[u8]) -> String {
    let mut out = String::with_capacity(len);
    let mut x: u32 = match n.unsigned_abs() {
        0 => 1,
        abs => abs as u32,
    };
    for _ in 0..len {
        // Match JS `(x * 1664525 + 1013904223) >>> 0` (mul in Number, then ToUint32).
        x = ((x as u64).wrapping_mul(1664525).wrapping_add(1013904223)) as u32;
        out.push(alphabet[x as usize % alphabet.len()] as char);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn curated_paths_match_typescript() {
        assert_eq!(render_faker_helper("person.firstName", 0), "Ada");
        assert!(!render_faker_helper("faker.person.lastName", 0).is_empty());
        assert_eq!(render_faker_helper("nope.missing", 1), "");
        assert_eq!(render_faker_helper("datatype.boolean", 0), "true");
        assert_eq!(render_faker_helper("datatype.boolean", 1), "false");
        let uuid = render_faker_helper("string.uuid", 9);
        assert!(
            regex_is_uuid4a(&uuid),
            "{uuid}"
        );
        for path in [
            "person.fullName",
            "internet.email",
            "internet.userName",
            "location.city",
            "lorem.word",
            "lorem.sentence",
            "string.alphanumeric",
            "number.int",
            "commerce.product",
            "phone.number",
        ] {
            assert!(!render_faker_helper(path, 3).is_empty(), "{path}");
        }
    }

    fn regex_is_uuid4a(s: &str) -> bool {
        let b = s.as_bytes();
        b.len() == 36
            && b[8] == b'-'
            && b[13] == b'-'
            && b[14] == b'4'
            && b[18] == b'-'
            && b[19] == b'a'
            && b[23] == b'-'
    }
}
