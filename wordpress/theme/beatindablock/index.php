<?php get_header(); ?>

<main>
  <!-- Hero -->
  <section class="hero">
    <div class="hero__inner">
      <?php if ( has_custom_logo() ) : ?>
        <div class="hero__logo"><?php the_custom_logo(); ?></div>
      <?php endif; ?>
      <h1 class="hero__title">BeatinDaBlock</h1>
      <p class="hero__sub">Underground hip-hop. Real culture. Since 2012.</p>
      <div class="hero__cta">
        <a class="btn btn--primary" href="<?php echo esc_url( get_post_type_archive_link( 'episode' ) ); ?>">
          Listen Now
        </a>
        <a class="btn btn--ghost" href="<?php echo esc_url( home_url( '/about/' ) ); ?>">
          Our Story
        </a>
      </div>
    </div>
  </section>

  <!-- Latest Episode -->
  <section class="section latest-episode">
    <div class="section__inner">
      <h2>Latest Episode</h2>
      <?php
        $latest = new WP_Query( [
            'post_type'      => 'episode',
            'posts_per_page' => 1,
            'orderby'        => 'date',
            'order'          => 'DESC',
        ] );
        if ( $latest->have_posts() ) :
            while ( $latest->have_posts() ) : $latest->the_post();
                $audio_url   = get_post_meta( get_the_ID(), '_episode_audio_url', true );
                $duration    = get_post_meta( get_the_ID(), '_episode_duration', true );
                $guest       = get_post_meta( get_the_ID(), '_episode_guest', true );
      ?>
        <article class="episode-card episode-card--large">
          <?php if ( has_post_thumbnail() ) : ?>
            <div class="episode-card__thumb"><?php the_post_thumbnail( 'medium' ); ?></div>
          <?php endif; ?>
          <h3 class="episode-card__title">
            <a href="<?php the_permalink(); ?>"><?php the_title(); ?></a>
          </h3>
          <p class="episode-card__meta">
            <?php echo esc_html( get_the_date() ); ?>
            <?php if ( $guest ) : ?>
              &nbsp;·&nbsp; Guest: <?php echo esc_html( $guest ); ?>
            <?php endif; ?>
            <?php if ( $duration ) : ?>
              &nbsp;·&nbsp; <?php echo esc_html( $duration ); ?>
            <?php endif; ?>
          </p>
          <div class="episode-card__desc"><?php the_excerpt(); ?></div>
          <?php if ( $audio_url ) : ?>
            <audio controls preload="none" src="<?php echo esc_url( $audio_url ); ?>" style="width:100%;margin:1rem 0;"></audio>
          <?php endif; ?>
          <a class="btn btn--primary" href="<?php the_permalink(); ?>">Full Episode →</a>
        </article>
      <?php
            endwhile;
            wp_reset_postdata();
        else :
      ?>
        <p class="loading">No episodes yet — check back soon.</p>
      <?php endif; ?>
    </div>
  </section>

  <!-- Recent Episodes -->
  <section class="section recent-episodes">
    <div class="section__inner">
      <h2>Recent Episodes</h2>
      <?php
        $recent = new WP_Query( [
            'post_type'      => 'episode',
            'posts_per_page' => 6,
            'offset'         => 1,
            'orderby'        => 'date',
            'order'          => 'DESC',
        ] );
        if ( $recent->have_posts() ) :
      ?>
        <div class="episodes-grid">
        <?php while ( $recent->have_posts() ) : $recent->the_post(); ?>
          <article class="episode-card">
            <h3 class="episode-card__title">
              <a href="<?php the_permalink(); ?>"><?php the_title(); ?></a>
            </h3>
            <p class="episode-card__meta"><?php echo esc_html( get_the_date() ); ?></p>
            <div class="episode-card__desc"><?php the_excerpt(); ?></div>
            <a class="btn btn--primary" href="<?php the_permalink(); ?>" style="margin-top:1rem">Listen →</a>
          </article>
        <?php endwhile; wp_reset_postdata(); ?>
        </div>
      <?php endif; ?>
      <a class="btn btn--primary" href="<?php echo esc_url( get_post_type_archive_link( 'episode' ) ); ?>">
        All Episodes →
      </a>
    </div>
  </section>

</main>

<?php get_footer(); ?>
