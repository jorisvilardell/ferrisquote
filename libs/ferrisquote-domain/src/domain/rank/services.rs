use crate::domain::rank::entities::Rank;
use crate::domain::rank::ports::RankService;

#[derive(Clone)]
pub struct LexoRankProvider;

impl RankService for LexoRankProvider {
    fn initial(&self) -> Rank {
        let bucket = lexorank::Bucket::new(0).expect("Invalid bucket");
        let rank = lexorank::Rank::new("n").expect("Invalid initial rank value");
        let lexo = lexorank::LexoRank::new(bucket, rank);

        Rank::from_string(lexo.to_string())
    }

    fn between(&self, before: &Rank, after: &Rank) -> Rank {
        let before_lexo =
            lexorank::LexoRank::from_string(before.as_str()).expect("Invalid `before` rank");
        let after_lexo =
            lexorank::LexoRank::from_string(after.as_str()).expect("Invalid `after` rank");

        let between = before_lexo
            .between(&after_lexo)
            .expect("Cannot calculate rank between these two ranks");

        Rank::from_string(between.to_string())
    }

    fn after(&self, rank: &Rank) -> Rank {
        let lexo = lexorank::LexoRank::from_string(rank.as_str()).expect("Invalid rank");
        Rank::from_string(lexo.next().to_string())
    }

    fn before(&self, rank: &Rank) -> Rank {
        let lexo = lexorank::LexoRank::from_string(rank.as_str()).expect("Invalid rank");
        Rank::from_string(lexo.prev().to_string())
    }
}
