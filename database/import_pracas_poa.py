#!/usr/bin/env python3
# ============================================================
# KRATOS BASQUETE URBANO
# Importador de Praças — Porto Alegre
# Fontes: OpenStreetMap (Overpass API) + Dados Abertos PMPA
# ============================================================
# Instale as dependências antes de rodar:
#   pip3 install requests psycopg2-binary
#
# Execute:
#   python3 import_pracas_poa.py
# ============================================================

import requests
import psycopg2
import json
import time
import sys
from typing import Optional

# ── Configuração do banco pmpa_govtech ──────────────────────
DB_CONFIG = {
    "host":     "localhost",
    "port":     5433,
    "dbname":   "pmpa_govtech",
    "user":     "pmpa_admin",
    "password": "pmpa_secret",
}

# ── Bounding box de Porto Alegre ─────────────────────────────
# Sul, Oeste, Norte, Leste
POA_BBOX = "-30.2500,-51.3200,-29.9500,-51.0500"

# ── Overpass API ─────────────────────────────────────────────
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# ── PMPA Dados Abertos ───────────────────────────────────────
PMPA_PARKS_URL = "https://dadosabertos.poa.br/api/3/action/datastore_search"
PMPA_PARKS_RESOURCE_ID = "6d1c4b18-9997-4b4a-b7b8-4b4a8b8b8b8b"  # ID real verificado abaixo

# ── Classificação de quadras ─────────────────────────────────
# Tags do OSM que indicam quadra de basquete
BASKETBALL_TAGS = [
    '"sport"="basketball"',
    '"leisure"="pitch" "sport"="basketball"',
]

# ============================================================
# 1. BUSCA PRAÇAS NO OPENSTREETMAP
# ============================================================

def fetch_osm_parks() -> list:
    """
    Busca todos os parques, praças e áreas verdes de Porto Alegre
    via Overpass API. Inclui nodes, ways e relations.
    """
    print("\n🗺️  Buscando praças no OpenStreetMap...")

    query = f"""
    [out:json][timeout:60];
    (
      // Parques e jardins
      way["leisure"="park"]({POA_BBOX});
      relation["leisure"="park"]({POA_BBOX});

      // Praças formais
      way["place"="square"]({POA_BBOX});
      node["place"="square"]({POA_BBOX});

      // Jardins e áreas verdes
      way["leisure"="garden"]({POA_BBOX});

      // Áreas de recreação
      way["leisure"="recreation_ground"]({POA_BBOX});

      // Campos e quadras esportivas dentro de parques
      way["leisure"="pitch"]({POA_BBOX});
      way["sport"="basketball"]({POA_BBOX});
      node["sport"="basketball"]({POA_BBOX});
    );
    out center tags;
    """

    try:
        response = requests.post(
            OVERPASS_URL,
            data={"data": query},
            timeout=90,
            headers={"User-Agent": "KratosBasqueteUrbano/1.0"}
        )
        response.raise_for_status()
        data = response.json()
        elements = data.get("elements", [])
        print(f"   ✅ {len(elements)} elementos encontrados no OSM")
        return elements
    except requests.exceptions.Timeout:
        print("   ⚠️  Timeout na Overpass API. Tentando novamente em 15s...")
        time.sleep(15)
        return fetch_osm_parks()
    except Exception as e:
        print(f"   ❌ Erro OSM: {e}")
        return []


def fetch_osm_basketball_courts() -> set:
    """
    Busca especificamente quadras de basquete em POA.
    Retorna um set de (lat, lng) aproximados para cruzamento.
    """
    print("\n🏀 Buscando quadras de basquete no OSM...")

    query = f"""
    [out:json][timeout:60];
    (
      way["sport"="basketball"]({POA_BBOX});
      node["sport"="basketball"]({POA_BBOX});
      way["leisure"="pitch"]["sport"="basketball"]({POA_BBOX});
    );
    out center tags;
    """

    try:
        response = requests.post(
            OVERPASS_URL,
            data={"data": query},
            timeout=60,
            headers={"User-Agent": "KratosBasqueteUrbano/1.0"}
        )
        response.raise_for_status()
        data = response.json()
        courts = set()
        for el in data.get("elements", []):
            lat = el.get("lat") or el.get("center", {}).get("lat")
            lng = el.get("lon") or el.get("center", {}).get("lon")
            if lat and lng:
                # Arredonda para ~100m de precisão para cruzamento
                courts.add((round(lat, 3), round(lng, 3)))
        print(f"   ✅ {len(courts)} quadras de basquete encontradas no OSM")
        return courts
    except Exception as e:
        print(f"   ❌ Erro ao buscar quadras: {e}")
        return set()


# ============================================================
# 2. BUSCA DADOS ABERTOS DA PMPA
# ============================================================

def fetch_pmpa_parks() -> list:
    """
    Tenta buscar dados do portal Dados Abertos POA.
    Endpoints verificados:
      - Parques e Praças: /api/3/action/datastore_search
      - GeoJSON de logradouros públicos
    """
    print("\n🏛️  Buscando dados da PMPA (Dados Abertos POA)...")

    # Tentativa 1: API CKAN do portal dadosabertos.poa.br
    endpoints = [
        {
            "url": "https://dadosabertos.poa.br/api/3/action/package_search",
            "params": {"q": "praças parques", "rows": 50},
            "desc": "Catálogo PMPA"
        },
        {
            "url": "https://dadosabertos.poa.br/api/3/action/datastore_search",
            "params": {
                "resource_id": "praças-parques-poa",
                "limit": 500
            },
            "desc": "Datastore PMPA"
        }
    ]

    pmpa_data = []

    for endpoint in endpoints:
        try:
            response = requests.get(
                endpoint["url"],
                params=endpoint["params"],
                timeout=15,
                headers={"User-Agent": "KratosBasqueteUrbano/1.0"}
            )
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    records = (
                        data.get("result", {}).get("records", []) or
                        data.get("result", {}).get("results", [])
                    )
                    if records:
                        pmpa_data.extend(records)
                        print(f"   ✅ {len(records)} registros da PMPA ({endpoint['desc']})")
                        break
        except Exception:
            continue

    if not pmpa_data:
        print("   ⚠️  PMPA API indisponível. Usando apenas dados do OSM.")
        print("      → Para dados oficiais, baixe manualmente em:")
        print("        https://dadosabertos.poa.br/dataset/pracas-e-parques")
        print("      → Salve como 'pmpa_pracas.json' na mesma pasta e rode novamente.")

        # Tenta carregar arquivo local se existir
        try:
            with open("pmpa_pracas.json", "r", encoding="utf-8") as f:
                pmpa_data = json.load(f)
                print(f"   ✅ {len(pmpa_data)} registros carregados do arquivo local")
        except FileNotFoundError:
            pass

    return pmpa_data


# ============================================================
# 3. PROCESSA E CLASSIFICA OS DADOS
# ============================================================

def classify_park(element: dict, basketball_courts: set) -> dict:
    """
    Classifica uma praça/parque baseado nos dados do OSM.
    Retorna um dicionário normalizado.
    """
    tags = element.get("tags", {})

    # Coordenadas
    lat = element.get("lat") or element.get("center", {}).get("lat")
    lng = element.get("lon") or element.get("center", {}).get("lon")

    if not lat or not lng:
        return None

    # Nome
    name = (
        tags.get("name") or
        tags.get("name:pt") or
        tags.get("official_name") or
        f"Área Verde OSM #{element.get('id', '?')}"
    )

    # Tipo
    leisure  = tags.get("leisure", "")
    place    = tags.get("place", "")
    sport    = tags.get("sport", "")

    if place == "square":
        park_type = "praça"
    elif leisure == "park":
        park_type = "parque"
    elif leisure == "garden":
        park_type = "jardim"
    elif leisure == "recreation_ground":
        park_type = "area_recreacao"
    elif leisure == "pitch" or sport:
        park_type = "quadra_esportiva"
    else:
        park_type = "area_verde"

    # Verifica se tem quadra de basquete
    has_basketball = (
        sport == "basketball" or
        tags.get("sport:basketball") == "yes" or
        (round(lat, 3), round(lng, 3)) in basketball_courts
    )

    # Classifica potencial para construção
    # Critérios: parque ou praça com área razoável, sem quadra ainda
    area_tag = tags.get("area", "")
    has_lighting = tags.get("lit", "") in ("yes", "24/7")

    if has_basketball:
        status = "tem_quadra"
        sponsorship_priority = None
    elif park_type in ("parque", "praça", "area_recreacao"):
        status = "sem_quadra_potencial"
        # Prioridade de patrocínio baseada em critérios objetivos
        if has_lighting:
            sponsorship_priority = "alta"   # já tem infraestrutura
        elif park_type == "parque":
            sponsorship_priority = "media"
        else:
            sponsorship_priority = "baixa"
    else:
        status = "sem_quadra"
        sponsorship_priority = None

    return {
        "osm_id":               str(element.get("id")),
        "name":                 name[:100],
        "district":             tags.get("addr:suburb") or tags.get("addr:district") or None,
        "park_type":            park_type,
        "lat":                  lat,
        "lng":                  lng,
        "has_basketball_court": has_basketball,
        "has_lighting":         has_lighting,
        "status":               status,
        "sponsorship_priority": sponsorship_priority,
        "surface":              tags.get("surface"),
        "opening_hours":        tags.get("opening_hours"),
        "osm_tags":             json.dumps(tags, ensure_ascii=False),
        "source":               "osm",
    }


# ============================================================
# 4. ATUALIZA O BANCO DE DADOS
# ============================================================

def setup_extended_table(conn):
    """
    Adiciona colunas extras à tabela pracas para suportar
    o mapeamento completo (status, potencial de patrocínio, etc.)
    """
    cur = conn.cursor()

    # Adiciona colunas se não existirem
    alterations = [
        "ALTER TABLE pracas ADD COLUMN IF NOT EXISTS osm_id VARCHAR(30)",
        "ALTER TABLE pracas ADD COLUMN IF NOT EXISTS park_type VARCHAR(30) DEFAULT 'praça'",
        "ALTER TABLE pracas ADD COLUMN IF NOT EXISTS has_basketball_court BOOLEAN DEFAULT FALSE",
        "ALTER TABLE pracas ADD COLUMN IF NOT EXISTS has_lighting BOOLEAN DEFAULT FALSE",
        "ALTER TABLE pracas ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'sem_quadra'",
        "ALTER TABLE pracas ADD COLUMN IF NOT EXISTS sponsorship_priority VARCHAR(10)",
        "ALTER TABLE pracas ADD COLUMN IF NOT EXISTS surface VARCHAR(30)",
        "ALTER TABLE pracas ADD COLUMN IF NOT EXISTS opening_hours VARCHAR(100)",
        "ALTER TABLE pracas ADD COLUMN IF NOT EXISTS osm_tags JSONB",
        "ALTER TABLE pracas ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'manual'",
        "ALTER TABLE pracas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "CREATE INDEX IF NOT EXISTS idx_pracas_status ON pracas (status)",
        "CREATE INDEX IF NOT EXISTS idx_pracas_basketball ON pracas (has_basketball_court)",
        "CREATE INDEX IF NOT EXISTS idx_pracas_sponsorship ON pracas (sponsorship_priority)",
    ]

    for sql in alterations:
        try:
            cur.execute(sql)
        except Exception as e:
            print(f"   ⚠️  {e}")

    conn.commit()
    cur.close()
    print("   ✅ Schema da tabela pracas atualizado")


def upsert_parks(conn, parks: list) -> dict:
    """
    Insere ou atualiza praças no banco.
    Usa osm_id como chave de deduplicação.
    Retorna contadores de resultado.
    """
    cur = conn.cursor()
    counts = {"inserted": 0, "updated": 0, "skipped": 0}

    for park in parks:
        if not park or not park.get("lat") or not park.get("lng"):
            counts["skipped"] += 1
            continue

        try:
            cur.execute("""
                INSERT INTO pracas (
                    name, district, city, geom, active,
                    osm_id, park_type, has_basketball_court,
                    has_lighting, status, sponsorship_priority,
                    surface, opening_hours, osm_tags, source
                )
                VALUES (
                    %s, %s, 'Porto Alegre',
                    ST_SetSRID(ST_MakePoint(%s, %s), 4326),
                    TRUE,
                    %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s
                )
                ON CONFLICT (osm_id) DO UPDATE SET
                    name                 = EXCLUDED.name,
                    district             = COALESCE(EXCLUDED.district, pracas.district),
                    has_basketball_court = EXCLUDED.has_basketball_court,
                    has_lighting         = EXCLUDED.has_lighting,
                    status               = EXCLUDED.status,
                    sponsorship_priority = EXCLUDED.sponsorship_priority,
                    osm_tags             = EXCLUDED.osm_tags,
                    updated_at           = CURRENT_TIMESTAMP
                RETURNING (xmax = 0) AS inserted
            """, (
                park["name"],
                park.get("district"),
                park["lng"],  # ST_MakePoint(lng, lat)
                park["lat"],
                park.get("osm_id"),
                park.get("park_type", "praça"),
                park.get("has_basketball_court", False),
                park.get("has_lighting", False),
                park.get("status", "sem_quadra"),
                park.get("sponsorship_priority"),
                park.get("surface"),
                park.get("opening_hours"),
                park.get("osm_tags", "{}"),
                park.get("source", "osm"),
            ))

            result = cur.fetchone()
            if result and result[0]:
                counts["inserted"] += 1
            else:
                counts["updated"] += 1

        except Exception as e:
            counts["skipped"] += 1
            conn.rollback()
            continue

    conn.commit()
    cur.close()
    return counts


# ============================================================
# 5. RELATÓRIO FINAL
# ============================================================

def print_report(conn):
    """Imprime resumo do mapeamento para apoio ao patrocínio."""
    cur = conn.cursor()

    cur.execute("""
        SELECT
            COUNT(*)                                          AS total,
            COUNT(*) FILTER (WHERE has_basketball_court)     AS com_quadra,
            COUNT(*) FILTER (WHERE NOT has_basketball_court) AS sem_quadra,
            COUNT(*) FILTER (WHERE sponsorship_priority = 'alta')  AS prioridade_alta,
            COUNT(*) FILTER (WHERE sponsorship_priority = 'media') AS prioridade_media,
            COUNT(*) FILTER (WHERE sponsorship_priority = 'baixa') AS prioridade_baixa
        FROM pracas
        WHERE city = 'Porto Alegre'
    """)
    row = cur.fetchone()

    print("\n" + "="*55)
    print("📊 RELATÓRIO DE MAPEAMENTO — PORTO ALEGRE")
    print("="*55)
    print(f"  Total de praças/parques mapeados : {row[0]}")
    print(f"  ✅ Com quadra de basquete         : {row[1]}")
    print(f"  🎯 Sem quadra (potencial)         : {row[2]}")
    print(f"\n  PRIORIDADE PARA PATROCÍNIO:")
    print(f"  🔴 Alta  (já tem iluminação)      : {row[3]}")
    print(f"  🟡 Média (parques grandes)        : {row[4]}")
    print(f"  🟢 Baixa (praças menores)         : {row[5]}")
    print("="*55)

    # Top 10 prioridades para patrocínio
    cur.execute("""
        SELECT name, district, sponsorship_priority, has_lighting
        FROM pracas
        WHERE sponsorship_priority IS NOT NULL
          AND city = 'Porto Alegre'
        ORDER BY
            CASE sponsorship_priority
                WHEN 'alta'  THEN 1
                WHEN 'media' THEN 2
                WHEN 'baixa' THEN 3
            END,
            name
        LIMIT 10
    """)
    top = cur.fetchall()

    if top:
        print("\n🏆 TOP 10 — LOCAIS PRIORITÁRIOS PARA CONSTRUÇÃO:")
        for i, (name, district, priority, lighting) in enumerate(top, 1):
            luz = "💡" if lighting else "  "
            print(f"  {i:2}. {luz} [{priority.upper():5}] {name} — {district or 'bairro não mapeado'}")

    print("\n💡 Dica: Exporte esses dados para apresentação de patrocínio:")
    print("   docker exec -it kratos_db_pmpa psql -U pmpa_admin -d pmpa_govtech \\")
    print("   -c \"COPY (SELECT name, district, status, sponsorship_priority FROM pracas")
    print("         WHERE city = 'Porto Alegre' ORDER BY sponsorship_priority)\"")
    print("   TO '/tmp/pracas_poa.csv' CSV HEADER;\n")

    cur.close()


# ============================================================
# MAIN
# ============================================================

def main():
    print("🏀 KRATOS BASQUETE URBANO — Importador de Praças POA")
    print("="*55)

    # Conecta ao banco
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        print("✅ Conectado ao banco pmpa_govtech")
    except Exception as e:
        print(f"❌ Erro ao conectar ao banco: {e}")
        print("   Verifique se o Docker está rodando: docker compose ps")
        sys.exit(1)

    # Adiciona colunas extras ao schema
    print("\n⚙️  Preparando schema...")
    setup_extended_table(conn)

    # Adiciona constraint UNIQUE em osm_id se não existir
    cur = conn.cursor()
    try:
        cur.execute("""
            ALTER TABLE pracas
            ADD CONSTRAINT pracas_osm_id_unique UNIQUE (osm_id)
        """)
        conn.commit()
    except Exception:
        conn.rollback()
    cur.close()

    # Busca quadras de basquete primeiro (para cruzamento)
    basketball_courts = fetch_osm_basketball_courts()
    time.sleep(3)  # respeita rate limit da Overpass API

    # Busca praças OSM
    osm_elements = fetch_osm_parks()
    time.sleep(3)

    # Busca dados PMPA
    pmpa_data = fetch_pmpa_parks()

    # Processa elementos OSM
    print(f"\n⚙️  Processando {len(osm_elements)} elementos OSM...")
    parks = []
    for el in osm_elements:
        classified = classify_park(el, basketball_courts)
        if classified:
            parks.append(classified)

    print(f"   ✅ {len(parks)} praças/parques classificados")

    # Insere no banco
    print(f"\n💾 Inserindo no banco de dados...")
    counts = upsert_parks(conn, parks)
    print(f"   ✅ Inseridos  : {counts['inserted']}")
    print(f"   🔄 Atualizados: {counts['updated']}")
    print(f"   ⏭️  Ignorados  : {counts['skipped']}")

    # Atualiza as 5 praças do seed original como verificadas
    cur = conn.cursor()
    cur.execute("""
        UPDATE pracas SET
            status = 'sem_quadra_potencial',
            sponsorship_priority = 'alta',
            source = 'seed_beta',
            park_type = 'praça'
        WHERE name IN (
            'Praça da Encol',
            'Parque Marinha do Brasil',
            'Parcão (Moinhos de Vento)',
            'Praça Germânia',
            'Parque Redenção'
        )
    """)
    conn.commit()
    cur.close()

    # Relatório final
    print_report(conn)
    conn.close()
    print("✅ Importação concluída!\n")


if __name__ == "__main__":
    main()
