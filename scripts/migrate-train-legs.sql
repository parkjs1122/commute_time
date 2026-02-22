-- 기존 기차 데이터 보정: type="bus"로 저장된 기차 구간을 type="train"으로 변환
-- 기차 lineName 패턴: KTX, SRT, ITX, 무궁화, 누리로, 열차 등

UPDATE "RouteLeg"
SET type = 'train'
WHERE type = 'bus'
  AND "lineNames" && ARRAY[
    'KTX', 'KTX-산천', 'KTX-이음',
    'SRT',
    'ITX-새마을', 'ITX-마음', 'ITX-청춘', 'ITX',
    '무궁화', '무궁화호',
    '누리로',
    '열차',
    'TRAIN'
  ];
