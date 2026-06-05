<?php
/**
 * Single Episode template
 */
get_header();

while ( have_posts() ) : the_post();
    $audio_url  = get_post_meta( get_the_ID(), '_episode_audio_url', true );
    $duration   = get_post_meta( get_the_ID(), '_episode_duration', true );
    $guest      = get_post_meta( get_the_ID(), '_episode_guest', true );
    $ep_num     = get_post_meta( get_the_ID(), '_episode_number', true );
?>

<article <?php post_class( 'section' ); ?>>
  <div class="section__inner" style="max-width:800px;">

    <?php if ( $ep_num ) : ?>
      <p style="color:var(--color-muted);font-size:.85rem;text-transform:uppercase;letter-spacing:.08em;">
        Episode <?php echo esc_html( $ep_num ); ?>
      </p>
    <?php endif; ?>

    <h1 style="font-family:var(--font-heading);font-size:clamp(1.8rem,4vw,2.8rem);margin-bottom:1rem;">
      <?php the_title(); ?>
    </h1>

    <p style="color:var(--color-muted);margin-bottom:1.5rem;">
      <?php echo esc_html( get_the_date() ); ?>
      <?php if ( $guest )    : ?> &nbsp;·&nbsp; Guest: <?php echo esc_html( $guest ); ?> <?php endif; ?>
      <?php if ( $duration ) : ?> &nbsp;·&nbsp; <?php echo esc_html( $duration ); ?>     <?php endif; ?>
    </p>

    <?php if ( $audio_url ) : ?>
      <audio controls preload="metadata" src="<?php echo esc_url( $audio_url ); ?>"
             style="width:100%;margin-bottom:2rem;"></audio>
    <?php endif; ?>

    <?php if ( has_post_thumbnail() ) : ?>
      <div style="margin-bottom:2rem;"><?php the_post_thumbnail( 'large' ); ?></div>
    <?php endif; ?>

    <div class="episode-content" style="color:var(--color-muted);line-height:1.8;">
      <?php the_content(); ?>
    </div>

    <div style="margin-top:3rem;padding-top:2rem;border-top:1px solid var(--color-border);">
      <a class="btn btn--ghost" href="<?php echo esc_url( get_post_type_archive_link( 'episode' ) ); ?>">
        ← All Episodes
      </a>
    </div>

  </div>
</article>

<?php
endwhile;
get_footer();
